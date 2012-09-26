const ALPHA                          = 0x1906;
const RGB                            = 0x1907;
const RGBA                           = 0x1908;
const LUMINANCE                      = 0x1909;
const LUMINANCE_ALPHA                = 0x190A;

const BYTE                           = 0x1400;
const UNSIGNED_BYTE                  = 0x1401;
const SHORT                          = 0x1402;
const UNSIGNED_SHORT                 = 0x1403;
const INT                            = 0x1404;
const UNSIGNED_INT                   = 0x1405;
const FLOAT                          = 0x1406;
const UNSIGNED_SHORT_4_4_4_4         = 0x8033;
const UNSIGNED_SHORT_5_5_5_1         = 0x8034;
const UNSIGNED_SHORT_5_6_5           = 0x8363;

function formatName(attribs) {
  switch (attribs.format) {
    case RGBA:
      switch (attribs.type) {
        case UNSIGNED_BYTE: return "RGBA8888";
        case UNSIGNED_SHORT_4_4_4_4: return "RGBA4444";
        case UNSIGNED_SHORT_5_5_5_1: return "RGBA5551";
        case FLOAT: return "RGBA/float";
        default: throw "unexpected type";
      }
    case RGB:
      switch (attribs.type) {
        case UNSIGNED_BYTE: return "RGB888";
        case UNSIGNED_SHORT_5_6_5: return "RGB565";
        case FLOAT: return "RGB/float";
        default: throw "unexpected type";
      }
    case ALPHA:
      switch (attribs.type) {
        case UNSIGNED_BYTE: return "A8";
        case FLOAT: return "A/float";
        default: throw "unexpected type";
      }
    case LUMINANCE:
      switch (attribs.type) {
        case UNSIGNED_BYTE: return "L8";
        case FLOAT: return "L/float";
        default: throw "unexpected type";
      }
    case LUMINANCE_ALPHA:
      switch (attribs.type) {
        case UNSIGNED_BYTE: return "LA88";
        case FLOAT: return "LA/float";
        default: throw "unexpected type";
      }
    default: throw "unknown format";
  }
}

function sourceName(source) {
  return source.data ? "ImageData "
       : source.getContext ? "Canvas"
       : "Image";
}

function premultiplicationStatusName(dstAttribs) {
  return dstAttribs.premultiplied ? "premult." : "unpremult.";
}

function testTextureConversion(source, dstAttribs) {
  function texConvTestFrame(test) {
    var gl = test.gl;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,
                      dstAttribs.format, dstAttribs.type,
                      source);
  }

  var manifest = {
    title  : "Texture conversion, from " +
             source.width + "&times;" + source.height + " " +
             sourceName(source) +
             " to " +
             formatName(dstAttribs) + " " +
             premultiplicationStatusName(dstAttribs),
    frameCallback : texConvTestFrame,
    frameMethod : "setTimeoutZero",
    repeat: 5,
    accountForGLFinishTime : false,
    requiredExtensions : dstAttribs.type == FLOAT ? ["OES_texture_float"] : null
  };
  var test = new WebGLPerformanceTest(manifest);

  var gl = test.gl;
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, dstAttribs.premultiplied);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  width = source.width;
  height = source.height;
  gl.texImage2D(gl.TEXTURE_2D, 0, dstAttribs.format, width, height, 0, dstAttribs.format, dstAttribs.type, null);

  test.run();
}

function randomCanvas(width, height) {
  const tilesize = 100;
  const defaultsize = 1024;

  if (!width) width = defaultsize;
  if (!height) height = defaultsize;
  var canvas2d = document.createElement("canvas");
  canvas2d.width = width;
  canvas2d.height = height;
  var context2d = canvas2d.getContext("2d");
  var imageData = context2d.createImageData(tilesize, tilesize);
  var imageDataLen = tilesize * tilesize * 4;
  for (var i = 0; i < imageDataLen; i++)
    imageData.data[i] = Math.floor(Math.random() * 256);
  for (var x = 0; x < width; x += tilesize)
    for (var y = 0; y < height; y += tilesize)
      context2d.putImageData(imageData, x, y);
  return canvas2d;
}

function randomImageData(width, height) {
  var canvas = randomCanvas(width, height);
  return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
}
