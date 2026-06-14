// global.js - put this in project root, same folder as index.js
if (typeof global.DOMRect === 'undefined') {
  global.DOMRect = class DOMRect {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height;
    }
    get top() { return this.y }
    get left() { return this.x }
    get right() { return this.x + this.width }
    get bottom() { return this.y + this.height }
  };
}