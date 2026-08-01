# SVG 图标说明
PWA 现代浏览器直接支持 SVG 图标。如需 PNG 版本，请在项目中使用以下方法之一：

1. 使用 Sharp (推荐):
   node scripts/convert-icons-sharp.js

2. 在线转换:
   将 public/icons/ 下的 SVG 上传到 https://convertio.co/svg-png/

3. 使用 ImageMagick:
   for size in 72 96 128 144 152 180 192 384 512; do
     convert -background none -size \$\{size}x$\{size} public/icons/icon-$\{size}x$\{size}.svg public/icons/icon-$\{size}x$\{size}.png
   done
