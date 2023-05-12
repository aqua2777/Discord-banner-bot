const stream = require('stream')
const EventEmitter = require('events')
const LZWEncoder = require('./LZWEncoder.js')
const NeuQuant = require('./TypedNeuQuant.js')
const { OctreeQuant, Color } = require('./OctreeQuant')

class ByteArray {
  constructor() {
    this.data = []
  }

  getData() {
    return Buffer.from(this.data)
  }

  writeByte(val) {
    this.data.push(val)
  }

  writeUTFBytes(str) {
    for (var len = str.length, i = 0; i < len; i++) {
      this.writeByte(str.charCodeAt(i))
    }
  }

  writeBytes(array, offset, length) {
    for (var len = length || array.length, i = offset || 0; i < len; i++) {
      this.writeByte(array[i])
    }
  }
}

class GIFEncoder extends EventEmitter {
  constructor(width, height, options = {emptyColor: false}) {
    super()
	  this.emptyColor = options.emptyColor
    this.width = ~~width
    this.height = ~~height
    this.frames = 1
    this.threshold = 90
    this.indexedPixels = null
    this.palSizeNeu = 7
    this.palSizeOct = 7
    this.sample = 10
    this.colorTab = null
    this.reuseTab = null
    this.colorDepth = null
    this.usedEntry = new Array()
    this.firstFrame = true
    this.started = false
    this.image = null
    this.dispose = -1
    this.repeat = 0
    this.delay = 0
    this.transparent = null
    this.transIndex = 0
    this.readStreams = []
    this.out = new ByteArray()
  }

  createReadStream(rs) {
    if (!rs) {
      rs = new stream.Readable()
      rs._read = function() {}
    }
    this.readStreams.push(rs)
    return rs
  }

  emitData() {
    if (this.readStreams.length === 0) {
      return
    }
    if (this.out.data.length) {
      this.readStreams.forEach(rs => {
        rs.push(Buffer.from(this.out.data))
      })
      this.out.data = []
    }
  }

  start() {
    this.out.writeUTFBytes('GIF89a')
    this.started = true
    this.emitData()
  }

  end() {
    if (this.readStreams.length === null) {
      return
    }
    this.emitData()
    this.readStreams.forEach(rs => rs.push(null))
    this.readStreams = []
  }

  addFrame(input, x = 0, y = 0, width = this.width, height = this.height) {
    if (input && input.getImageData) {
      this.image = input.getImageData(0, 0, width, height).data
    } else {
      this.image = input
    }

    this.analyzePixels(width, height)

    if (this.firstFrame) {
      this.writeLSD()
      this.writePalette()
      if (this.repeat !== 1 && this.repeat >= 0) {
        this.writeNetscapeExt()
      }
    }

    this.writeGraphicCtrlExt()
    this.writeImageDesc(x, y, width, height)
    this.writePixels(width, height)
    this.firstFrame = false
    this.emitData()

    if (this.totalFrames) {
      this.emit('progress', Math.floor((this.frames++ / this.totalFrames) * 100))
    }
  }

  analyzePixels(width, height) {
    const w = width
    const h = height

    var data = this.image
    function div(a,b){
      return (a-a%b)/b
    }
      var count = 0
      this.pixels = new Uint8Array(w * h * 3)
		if(!this.emptyColor){
      for (var i = 0; i < h; i++) {
        for (var j = 0; j < w; j++) {
          var b = i * w * 4 + j * 4
          this.pixels[count++] = data[b]
          this.pixels[count++] = data[b + 1]
          this.pixels[count++] = data[b + 2]
        }
      }
		}
		else{
			for (var i = 0; i < h; i++) {
				for (var j = 0; j < w; j++) {
				  var b = i * w * 4 + j * 4
				  if(data[b+3] === 255){
					  this.pixels[count++] = data[b]
					  this.pixels[count++] = data[b + 1]
					  this.pixels[count++] = data[b + 2]
				  }
				  else{
					if(data[b] === 0 && data[b + 1] === 0 && data[b + 2] === 0){
						this.pixels[count++] = data[b] 
						this.pixels[count++] = data[b + 1] 
						this.pixels[count++] = data[b + 2]
					}else{
						this.pixels[count++] = div(data[b] * (data[b + 3]),255)
						this.pixels[count++] = div(data[b + 1] * (data[b + 3]),255)
						this.pixels[count++] = div(data[b + 2] * (data[b + 3]),255)
					}
				  }
				}
			}
		}

      var nPix = this.pixels.length / 3
      this.indexedPixels = new Uint8Array(nPix)

      if (this.firstFrame) {
        this.quantizer = new NeuQuant(this.pixels, this.sample)
        this.quantizer.buildColormap()
        this.colorTab = this.quantizer.getColormap()
      }

      var k = 0
      for (var j = 0; j < nPix; j++) {
        var index = this.quantizer.lookupRGB(
          this.pixels[k++] & 0xff,
          this.pixels[k++] & 0xff,
          this.pixels[k++] & 0xff
        )
        this.usedEntry[index] = true
        this.indexedPixels[j] = index
	  }
	  
      this.colorDepth = 8
      this.palSizeNeu = 7
      this.pixels = null
    if (this.transparent !== null) {
      this.transIndex = this.findClosest(this.transparent)

      for (var pixelIndex = 0; pixelIndex < nPix; pixelIndex++) {
        if (this.image[pixelIndex * 4 + 3] == 0) {
          this.indexedPixels[pixelIndex] = this.transIndex
        }
      }
    }
  }

  findClosest(c) {
    if (this.colorTab === null) {
      return -1
    }

    var r = (c & 0xff0000) >> 16
    var g = (c & 0x00ff00) >> 8
    var b = c & 0x0000ff
    var minpos = 0
    var dmin = 256 * 256 * 256
    var len = this.colorTab.length

    for (var i = 0; i < len; ) {
      var index = i / 3
      var dr = r - (this.colorTab[i++] & 0xff)
      var dg = g - (this.colorTab[i++] & 0xff)
      var db = b - (this.colorTab[i++] & 0xff)
      var d = dr * dr + dg * dg + db * db
      if (this.usedEntry[index] && d < dmin) {
        dmin = d
        minpos = index
      }
    }

    return minpos
  }

  setFrameRate(fps) {
    this.delay = Math.round(100 / fps)
  }

  setDelay(ms) {
    this.delay = Math.round(ms / 10)
  }

  setDispose(code) {
    if (code >= 0) {
      this.dispose = code
    }
  }

  setRepeat(repeat) {
    this.repeat = repeat
  }

  setTransparent(color) {
    this.transparent = color
  }

  setQuality(quality) {
    if (quality < 1) {
      quality = 1
    }
    this.quality = quality
  }

  setThreshold(threshold) {
    if (threshold > 100) {
      threshold = 100
    } else if (threshold < 0) {
      threshold = 0
    }
    this.threshold = threshold
  }

  setPaletteSize(size) {
    if (size > 7) {
      size = 7
    } else if (size < 4) {
      size = 4
    }
    this.palSizeOct = size
  }

  writeLSD() {
    this.writeShort(this.width)
    this.writeShort(this.height)

    this.out.writeByte(0x80 | 0x70 | 0x00 | this.palSizeNeu)

    this.out.writeByte(0)
    this.out.writeByte(0)
  }

  writeGraphicCtrlExt() {
    this.out.writeByte(0x21)
    this.out.writeByte(0xf9)
    this.out.writeByte(4)

    var transp, disp
    if (this.transparent === null) {
      transp = 0
      disp = 0
    } else {
      transp = 1
      disp = 2
    }

    if (this.dispose >= 0) {
      disp = this.dispose & 7
    }
    disp <<= 2

    this.out.writeByte(this.emptyColor?5:4)

    this.writeShort(this.delay)
    this.out.writeByte(this.transIndex)
    this.out.writeByte(0)
  }

  writeNetscapeExt() {
    this.out.writeByte(0x21)
    this.out.writeByte(0xff)
    this.out.writeByte(11)
    this.out.writeUTFBytes('NETSCAPE2.0')
    this.out.writeByte(3)
    this.out.writeByte(1)
    this.writeShort(this.repeat)
    this.out.writeByte(0)
  }

  writeImageDesc(x = 0,y = 0, width, height) {
    this.out.writeByte(0x2c)
    this.writeShort(x)
    this.writeShort(y)
    this.writeShort(width)
    this.writeShort(height)
    this.out.writeByte(0)
  }

  writePalette() {
    this.out.writeBytes(this.colorTab)
    var n = 3 * 256 - this.colorTab.length
    for (var i = 0; i < n; i++) {
      this.out.writeByte(0)
    }
  }

  writeShort(pValue) {
    this.out.writeByte(pValue & 0xff)
    this.out.writeByte((pValue >> 8) & 0xff)
  }

  writePixels(width, height) {
    var enc = new LZWEncoder(width, height, this.indexedPixels, this.colorDepth)
    enc.encode(this.out)
  }

  finish() {
    this.out.writeByte(0x3b)
    this.end()
  }
}

module.exports = GIFEncoder
