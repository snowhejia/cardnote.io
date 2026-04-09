#!/bin/sh
# Xcode Cloud 只会在仓库内的 ci_scripts/ 中自动执行本脚本（见 Apple「Writing custom build scripts」）。
# ios/App/CapApp-SPM/Package.swift 依赖 ../../../node_modules/@capacitor/keyboard，须先安装 npm 依赖。
set -e
cd "${CI_PRIMARY_REPOSITORY_PATH:-.}"

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
