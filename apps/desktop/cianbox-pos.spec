# -*- mode: python ; coding: utf-8 -*-
"""
Especificacion de PyInstaller para Cianbox POS Desktop.

Para compilar ejecutar:
    pyinstaller cianbox-pos.spec --noconfirm
"""

import sys
from pathlib import Path

# Directorio del proyecto
project_dir = Path(SPECPATH)
src_dir = project_dir / 'src'
assets_dir = project_dir / 'assets'

block_cipher = None

a = Analysis(
    [str(src_dir / 'main.py')],
    pathex=[str(src_dir)],
    binaries=[],
    datas=[
        # Assets
        (str(assets_dir / 'icons'), 'assets/icons'),
        (str(assets_dir / 'images'), 'assets/images'),
        (str(assets_dir / 'fonts'), 'assets/fonts'),
        # Archivo de configuracion ejemplo
        (str(project_dir / '.env.example'), '.'),
    ],
    hiddenimports=[
        'PyQt6',
        'PyQt6.QtWidgets',
        'PyQt6.QtCore',
        'PyQt6.QtGui',
        'httpx',
        'httpx._transports.default',
        'h2',
        'hpack',
        'hyperframe',
        'pydantic',
        'pydantic_settings',
        'sqlalchemy',
        'loguru',
        'keyring',
        'keyring.backends',
        'escpos',
        'escpos.printer',
        'qrcode',
        'PIL',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'tkinter',
        'test',
        'tests',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='CianboxPOS',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Sin ventana de consola
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(assets_dir / 'icons' / 'app.ico') if (assets_dir / 'icons' / 'app.ico').exists() else None,
    version='file_version_info.txt' if Path('file_version_info.txt').exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='CianboxPOS',
)
