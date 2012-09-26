function setupSpeedTests() {
  var s = document.createElement("script");
  s.setAttribute("type", "text/javascript");
  s.src = "../js/speedtests.js";
  s.onload = function() {
    SpeedTests.init();
  };
  document.head.appendChild(s);
}

function WebGLPerformanceTest(manifest) {
  if (manifest.title === undefined) manifest.title = "Untitled";
  if (manifest.frameCallback === undefined) manifest.frameCallback = function() {};
  if (manifest.contextCreationFlags === undefined) manifest.contextCreationFlags = {};
  if (manifest.frameMethod === undefined) manifest.frameMethod = "requestAnimationFrame";
  if (manifest === undefined) manifest = {};
  if (manifest.width === undefined)
    manifest.width = (manifest.frameMethod == "requestAnimationFrame") ? 1024 : 1;
  if (manifest.height === undefined)
    manifest.height = (manifest.frameMethod == "requestAnimationFrame") ? 1024 : 1;
  if (manifest.repeat === undefined) manifest.repeat = 1;
  if (manifest.accountForGLFinishTime === undefined) manifest.accountForGLFinishTime = true;

  // Now modify based on some hash flags
  if (document.location.hash != null) {
    var hashFlags = document.location.hash.substr(1).split(",");
    for (var i = 0; i < hashFlags.length; ++i) {
      var flag = hashFlags[i];
      if (flag == "viewport") {
        manifest.useViewportSize = true;
      } else if (flag == "forcePostMessage") {
        manifest.frameMethod = "postMessage";
      } else if (flag == "asSpeedTest") {
        setupSpeedTests();
      }
    }
  }

  if (manifest.useViewportSize) {
    manifest.width = window.innerWidth;
    manifest.height = window.innerHeight;
    console.log("using " + manifest.width + "x" + manifest.height);
    console.log("screen " + window.screen.width + "x" + window.screen.height);
  }

  this.canvas = document.createElement("canvas", manifest);
  document.body.appendChild(this.canvas);
  this.title = document.createElement("div");
  document.body.appendChild(this.title);
  this.results = document.createElement("div");
  document.body.appendChild(this.results);

  if (manifest.useViewportSize) {
    this.canvas.setAttribute("style", "position: absolute; left: 0px; top: 0px;");
    this.title.setAttribute("style", "position: absolute; left: 5px; top: 2px;");
    this.results.setAttribute("style", "position: absolute; left: 5px; top: 50px;");

    this.title.style.display = "none";
    this.results.style.display = "none";
  }

  this.canvas.width = manifest.width;
  this.canvas.height = manifest.height;
  this.userFrameCallback = manifest.frameCallback;
  this.contextCreationFlags = manifest.contextCreationFlags;
  this.repeat = manifest.repeat;
  this.frameMethod = manifest.frameMethod;
  this.accountForGLFinishTime = manifest.accountForGLFinishTime;
  this.requiredExtensions = manifest.requiredExtensions;

  try {
    this.gl = this.canvas.getContext("experimental-webgl", this.contextCreationFlags);
  } catch(e) {
    this.gl = null;
  }

  this.frame = 0;
  this.timings = [];

  this.description = manifest.title +
    (this.contextCreationFlags.preserveDrawingBuffer ? ", with preserveDrawingBuffer" : "") +
    (this.repeat > 1 ? ", repeated " + this.repeat + "&times;" : "");
  if (this.frameMethod == "requestAnimationFrame")
    this.description += ", size " + this.canvas.width + "&times;" + this.canvas.height;

  this.title.innerHTML = "<h3>" + this.description + "</h3>";

  if (this.requiredExtensions) {
    for (var i = 0; i < this.requiredExtensions.length; i++) {
      if (!this.gl.getExtension(this.requiredExtensions[i])) {
        this.unsupportedRequiredExtension = this.requiredExtensions[i];
        this.finish();
        return;
      }
    }
  }

  window.requestAnimationFrame = 
    window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame;

  window.setTimeoutZero = function(callback) {
    window.setTimeout(callback, 0);
  };

  window.addEventListener("message", function(ev) {
    if (ev.data == "poke")
      window.postMessageCallback();
  }, false);

  window.doPostMessage = function(callback) {
    window.postMessageCallback = callback;
    window.postMessage("poke", "*");
  };

  if (this.frameMethod == "requestAnimationFrame") {
    window.requestFrameFunc = window.requestAnimationFrame;
    this.minimumLegalFrameDuration = 16;
  } else if (this.frameMethod == "setTimeoutZero") {
    window.requestFrameFunc = window.setTimeoutZero;
    this.minimumLegalFrameDuration = 0;
  } else if (this.frameMethod == "postMessage") {
    window.requestFrameFunc = window.doPostMessage;
    this.minimumLegalFrameDuration = 0;
  } else throw "unknown frameMethod: " + this.frameMethod;

  this.masterFrameCallbackBoundToThis = this.masterFrameCallback.bind(this);
}

WebGLPerformanceTest.prototype.registerFrameCallback = function() {
  window.requestFrameFunc(this.masterFrameCallbackBoundToThis);
}

WebGLPerformanceTest.prototype.masterFrameCallback = function(time)
{
  var timeAlreadyPassedToUs = !!time;

  // before the frame, if not using requestAnimationFrame, we have to get a timestamp
  if (!timeAlreadyPassedToUs) {
    // always finish before starting the benchmark
    this.gl.finish();
    if (window.performance.now)
      time = window.performance.now();
    else
      time = (new Date()).getTime();
  }

  // the actual frame rendering
  for (var i = 0; i < this.repeat; i++)
    this.userFrameCallback(this);

  if (this.lastTime) {
    // not the first frame
    var deltaTime = time - this.lastTime;
    if (this.shouldRecordPreviousFrame(deltaTime))
      this.timings.push(deltaTime);
  } else {
    // this is the first frame
    this.startTime = time;
  }

  if (this.hasRecordedEnoughFrames(time)) {
    this.finish(time);
    return;
  }

  this.lastTime = time;
  this.frame++;

  this.registerFrameCallback();
}

WebGLPerformanceTest.prototype.shouldRecordPreviousFrame = function(deltaTime) {
  // with requestAnimationFrame,
  // if deltaTime < 16 ms, all we have is a requestAnimationFrame bug as in
  // https://bugzilla.mozilla.org/show_bug.cgi?id=731974
  return deltaTime >= this.minimumLegalFrameDuration;
}

WebGLPerformanceTest.prototype.hasRecordedEnoughFrames = function(time) {
  // stop when we have recorded at least 10 frames and run for at least 3000 ms
  return this.timings.length > 10 && 
         time - this.startTime > 3000;
}

function reportResult(result) {
  if (window.SpeedTests == undefined) {
    parent.postMessage(result, "*");
    if (window.opener)
      window.opener.postMessage(result, "*");
    return;
  }

  console.log("result", result);

  if (result.skip) {
    SpeedTests.nextTest(result.testDescription);
    return;
  }

  if (result.error) {
    // XXX umm. what to do?
    SpeedTests.nextTest(result.testDescription);
    return;
  }

  SpeedTests.recordResults(result.testDescription, { value: result.testResult });
  SpeedTests.nextTest(result.testDescription);
}

WebGLPerformanceTest.prototype.finish = function(time) {
  var duration = time - this.startTime;

  this.title.style.display = null;
  this.results.style.display = null;

  if (this.unsupportedRequiredExtension) {
    this.results.innerHTML = "Requires unsupported extension: " + this.unsupportedRequiredExtension;
    reportResult({ testDescription : this.description, skip : true });
    return;
  }
  if (this.customError) {
    this.results.innerHTML = "Error: " + this.customError;
    reportResult({ testDescription : this.description, error : true });
    return;
  }
  if (this.gl.getError()) {
    this.results.innerHTML = "A WebGL error occurred!";
    reportResult({ testDescription : this.description, error : true });
    return;
  }

  var numSamples = this.timings.length;
  var sortedTimings = this.timings.slice(0);

  sortedTimings.sort(compareNumbers);

  var medianIndex = Math.floor(numSamples/2);

  var median = sortedTimings[medianIndex];
  var sum = 0;
  for(var i = 0; i < numSamples; i++)
      sum += this.timings[i];
  var average = sum / numSamples;
  var sumDiffSquares = 0;
  for(var i = 0; i < numSamples; i++) {
    var diff = this.timings[i] - average;
    sumDiffSquares += diff * diff;
  }
  var variance = sumDiffSquares / numSamples;
  var stdDev = Math.sqrt(variance);

  this.results.innerHTML =
    "frames: " + numSamples + " total ms: " + duration.toFixed(2) + "<br>" +
    "<b>median: " + median.toFixed(2) + " ms</b><br>" +
    "average: " + Math.round(average) + " ms<br>" +
    "standard deviation: " + Math.round(stdDev) + " ms " +
    "(" + Math.round(100*stdDev/median) + "% of median)<br>" +
    "sorted timings: <font size=-2>" + formatNumbersArray(sortedTimings.slice(0, medianIndex)).join(", ") +
    ", <b>" + median.toFixed(2) + "</b>, " + formatNumbersArray(sortedTimings.slice(medianIndex+1, this.timings.length)).join(", ") + "</font><br><br>" +
    "raw timings: <font size=-2>" + formatNumbersArray(this.timings).join(", ") + "</font><br>" +
    "";  

  reportResult({ testDescription : this.description, testResult : median });
}

function formatNumbersArray(nums) {
  var result = [];
  for (var i = 0; i < nums.length; ++i) {
    result.push(nums[i].toFixed(2));
  }

  return result;
}

function compareNumbers(a,b)
{
  return a - b;
}

WebGLPerformanceTest.prototype.run = function() {
  if (this.unsupportedRequiredExtension)
    return;
  if (this.gl) {
    this.results.innerHTML = "running...";
    this.registerFrameCallback();
  } else {
    this.results.innerHTML = "Could not get a WebGL context";
  }
}

WebGLPerformanceTest.prototype.error = function(e) {
  this.customError = e;
  this.finish();
  throw "error: " + e;
}

function test(manifest) {
  new WebGLPerformanceTest(manifest).run();
}