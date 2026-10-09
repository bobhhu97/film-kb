#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建 film-kb 的自托管字体子集。

真源是 Google Fonts 上游的可变字体 TTF。输出 web/fonts/*.woff2，网页离线可用。
用法:
    python3 tools/build-fonts.py          # 项目实际用字（默认，约 0.7 MB）
    python3 tools/build-fonts.py --safe   # 再并上 GB2312 一级字库（约 2.0 MB）

子集字符集 = 项目全部文本用字（含 CJK 标点）+ 拉丁与标点区间。
项目用字覆盖率 100%：站点所有正文都来自 shards/ 与 web/ 下的文本文件，
本脚本扫描的就是这些文件。

唯一的例外是用户自己键入的内容（词条笔记、搜索框）。这些字符不预置，
由 font-family 回退链交给系统中文字体渲染（macOS 上即苹方/宋体）。
若要让任意用户输入也用同一字体，跑 `--safe` 把 GB2312 一级字库并进来。

可变字体先实例化成静态字重再子集化：CJK 可变字体的 fvar/gvar 开销很大，
钉死字重后体积减半，而本项目的用字梯度只需要 400 与 600 两档。
"""
import os
import sys
import glob
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.fontsrc')
OUTDIR = os.path.join(ROOT, 'web', 'fonts')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
UPSTREAM = {
    'Fraunces.ttf':
        GF + 'fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf',
    'NotoSerifSC.ttf':
        GF + 'notoserifsc/NotoSerifSC%5Bwght%5D.ttf',
    'NotoSansSC.ttf':
        GF + 'notosanssc/NotoSansSC%5Bwght%5D.ttf',
    'IBMPlexMono-Regular.ttf':
        GF + 'ibmplexmono/IBMPlexMono-Regular.ttf',
    'IBMPlexMono-SemiBold.ttf':
        GF + 'ibmplexmono/IBMPlexMono-SemiBold.ttf',
}

# 扫描项目文本，收集实际用到的字符
TEXT_EXT = ('.html', '.css', '.js', '.json', '.md', '.mjs', '.txt')
SKIP_DIR = {'.git', 'node_modules', '.npm-cache', '.pw-home', '.fontsrc',
            'after', 'playwright', 'shots', 'img', 'fonts'}

LATIN_RANGES = (
    'U+0000-024F,U+0259,U+02B0-02FF,U+0300-036F,'
    'U+1E00-1EFF,U+2000-206F,U+2070-209F,U+20A0-20CF,'
    'U+2100-214F,U+2150-218F,U+2190-21FF,U+2200-22FF,'
    'U+2400-243F,U+25A0-25FF,U+2600-26FF,U+2700-27BF,'
    'U+2E00-2E7F,U+3000-303F,U+FEFF,U+FFFD'
)

# 只保留排版真正需要的 OpenType 特性
FEATURES = 'kern,liga,clig,calt,locl,ccmp,mark,mkmk,rlig,frac,tnum'


def download():
    os.makedirs(CACHE, exist_ok=True)
    for name, url in UPSTREAM.items():
        dst = os.path.join(CACHE, name)
        if os.path.exists(dst) and os.path.getsize(dst) > 4096:
            continue
        print(f'  下载 {name} …', flush=True)
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=180) as r, open(dst, 'wb') as f:
            f.write(r.read())


def project_chars():
    """项目全部文本文件里出现过的字符。"""
    chars = set()
    for path in glob.glob(os.path.join(ROOT, '**', '*'), recursive=True):
        if not os.path.isfile(path):
            continue
        parts = set(os.path.relpath(path, ROOT).split(os.sep))
        if parts & SKIP_DIR:
            continue
        if not path.endswith(TEXT_EXT):
            continue
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                chars.update(f.read())
        except OSError:
            pass
    return chars


def gb2312_l1_chars():
    """GB2312 一级字库（最常用 3755 字，区位 0xB0-0xD7）。"""
    out = set()
    for b1 in range(0xB0, 0xD8):
        for b2 in range(0xA1, 0xFF):
            try:
                out.add(bytes([b1, b2]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return out


def write_charset(chars, path):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(''.join(sorted(chars)))


def instance(src, dst, axes):
    """把可变字体实例化成静态字重。axes 为空则原样复制。"""
    if not axes:
        with open(src, 'rb') as a, open(dst, 'wb') as b:
            b.write(a.read())
        return dst
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    ft = TTFont(src)
    instancer.instantiateVariableFont(ft, axes, inplace=True,
                                      updateFontNames=False)
    ft.save(dst)
    ft.close()
    return dst


def subset(src, dst, text_file=None, unicodes=None):
    from fontTools import subset as st
    args = [
        src,
        f'--output-file={dst}',
        '--flavor=woff2',
        f'--layout-features={FEATURES}',
        '--desubroutinize',
        '--drop-tables+=DSIG,meta',
        '--name-IDs=*',
    ]
    if unicodes:
        args.append(f'--unicodes={unicodes}')
    if text_file:
        args.append(f'--text-file={text_file}')
    st.main(args)


def main():
    safe = '--safe' in sys.argv
    print('构建字体子集' + ('（含 GB2312 一级字库）' if safe else ''))
    download()
    os.makedirs(OUTDIR, exist_ok=True)

    cjk = {c for c in project_chars()
           if c.isprintable() and c not in '\r\n\t'}
    if safe:
        cjk |= gb2312_l1_chars()
    cjk_file = os.path.join(CACHE, 'charset.txt')
    write_charset(cjk, cjk_file)
    print(f'  CJK 子集字符数 {len(cjk)}')

    # (源文件, 输出名, 变体轴, 用字文件, 码位区间)
    jobs = [
        ('NotoSerifSC.ttf', 'noto-serif-sc-600.woff2',
         {'wght': 600}, cjk_file, None),
        ('NotoSansSC.ttf', 'noto-sans-sc-400.woff2',
         {'wght': 400}, cjk_file, None),
        ('Fraunces.ttf', 'fraunces-var.woff2',
         {'opsz': 60}, None, LATIN_RANGES),
        ('IBMPlexMono-Regular.ttf', 'plex-mono-400.woff2',
         None, None, LATIN_RANGES),
        ('IBMPlexMono-SemiBold.ttf', 'plex-mono-600.woff2',
         None, None, LATIN_RANGES),
    ]

    total = 0
    for name, out, axes, tf, uni in jobs:
        src = os.path.join(CACHE, name)
        inst = instance(src, os.path.join(CACHE, 'inst-' + out + '.ttf'), axes)
        dst = os.path.join(OUTDIR, out)
        subset(inst, dst, text_file=tf, unicodes=uni)
        kb = os.path.getsize(dst) / 1024
        total += kb
        print(f'  {out:26s} {kb:8.1f} KB')
    print(f'  合计 {total/1024:.2f} MB → web/fonts/')


if __name__ == '__main__':
    main()
