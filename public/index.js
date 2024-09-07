/* eslint-env browser */

// @ts-ignore
// import CodeMirror from "codemirror";
// import "codemirror/mode/clike/clike.js";
// import 'codemirror/addon/lint/lint';
// import {_fragmentShaderC, _vertexShaderC} from "./defaultShaders.js";

// const CodeMirror = require("./dist/codemirror.js");
// const {_fragmentShaderC, _vertexShaderC} = require("./defaultShaders.js");
// require("codemirror/mode/clike/clike.js");

// Element storage
var gl;

var editor;
let glCanvas = null;
let _fragmentShader = _fragmentShaderC;

// Current state storage
var isDirty = false;
let shaderProgram;
var socket;
// Aspect ratio and coordinate system
// details
let aspectRatio;
let resolution;

// Vertex information
let vertexArray;
let vertexBuffer;
let vertexNumComponents;
let vertexCount;

// Rendering data shared with the
// scalers.
let uResolution;
let uTime;
let uVol;
let aVertexPosition;

let timeSinceStuck = 0;
let timeElapsedToGetHelp = 1000;
let hasError =false;

// Animation timing
let previousTime = 0.0;
// this script is from cut-ruby.glitch.me
let sentCode = false;
// so good
var FFT_SIZE = 512;
var vol;

if (window.isProduction && window.location.protocol !== "https:") {
  window.location = "https://" + window.location.hostname;
}

class Camera {
  constructor() {
    this.video = document.createElement("video");
    this.video.setAttribute("muted", true);
    this.video.setAttribute("playsinline", false);

    this.selfie = false;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  _startCapture() {
    return navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false,
      })
      .then((stream) => {
        this.stream = stream;
        var source = this.audioCtx.createMediaStreamSource(stream);

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.smoothingTimeConstant = 0.9;
        this.analyser.fftSize = FFT_SIZE;
        source.connect(this.analyser);
      });
  }
  init() {
    this._startCapture();
    return this._startCapture();
  }
  flip() {
    this.selfie = !this.selfie;
    this._startCapture();
  }
}

let button = document.querySelector("button");
let camera;// new Camera();
//document.querySelector("body").appendChild(camera.video);

// document.addEventListener("click", function (e) {
//   camera
//     .init()
//     .then(start)
//     .catch((e) => console.error(e));
// });

// (function () {
//   camera
//     .init()
//     .then(start)
//     .catch((e) => console.error(e));
// })();

function start() {}

function getSelectionText() {
  let text = "";

  if (window.getSelection) {
      text = window.getSelection().toString();
  } else if (document.selection && document.selection.type != "Control") {
      text = document.selection.createRange().text;
  }

  return text;
}
function handleRightClick(event) {
  event.preventDefault(); // Prevent the default context menu
  const selectedText = getSelectionText();
  console.log("Selected text:", selectedText);
  if (selectedText != ""){
  sendCodeOverWire("normal", selectedText);
  }
  // You can perform any action with the selected text here
}

// Add event listener to the document
document.addEventListener('contextmenu', handleRightClick);

// from here https://hackernoon.com/creative-coding-using-the-microphone-to-make-sound-reactive-art-part1-164fd3d972f3
// A more accurate way to get overall volume
function getRMS(spectrum) {
  var rms = 0;
  for (var i = 0; i < spectrum.length; i++) {
    rms += spectrum[i] * spectrum[i];
  }
  rms /= spectrum.length;
  rms = Math.sqrt(rms);
  let norm = rms / 128;
  return (norm - 0.99) * 100;
}

function isInPresentationMode() {
  if (window.location.pathname.split('/').pop() == 'present.html') {
    return true;
  }
  return true;
}

function addCodeMirrorPresentModifier() {
  const codeMirrorDiv = document.querySelector(".CodeMirror");
  if (codeMirrorDiv) {
    codeMirrorDiv.classList.add("CodeMirror-present");
  }
}

function addCodeMirrorEditorModifier() {
  const codeMirrorDiv = document.querySelector(".CodeMirror");
  if (codeMirrorDiv) codeMirrorDiv.classList.add("CodeMirror-editor");
}

function init() {
 
  //set time now to timesincestuck
  timeSinceStuck = Date.now();
  // SOCKET IO
  socket = io();
  // addSendButton()

  var editorContainer = document.getElementById("editor");
  editor = CodeMirror(editorContainer, {
    value: _fragmentShader,
    lineNumbers: true,
    mode: "x-shader/x-vertex",
    gutters: ["CodeMirror-lint-markers"],
    lint: true,
    lineWrapping: !isInPresentationMode()
  });

  editor.on('change', onEdit);
  onEdit();
 
  addCodeMirrorEditorModifier()
  socket.on('code', function(shaderCode) {
    console.log("got code from socketIO")
    
    _fragmentShader = shaderCode;

   // needsUpdate = true;
    sentCode = false;
    hasError = false;
    //editor.setValue(shaderCode);
    navigator.clipboard.writeText(shaderCode).then(() => {
      console.log('Shader code copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy shader code: ', err);
    });
    //onEdit()
    //console.log("got code from socketIO")

  });

}


// this function will trigger a change to the editor
function onEdit() {
  const fragmentCode = editor.getValue();
  updateShader(fragmentCode);
}

function updateShader(fragmentCode) {
  if (checkFragmentShader(fragmentCode) != []) {
    console.log("error in shader");
    return;
  }
  console.log("NO error in shader");
  _fragmentShader = fragmentCode;

  isDirty = true;
}

window.onload = (event) => {
  webgl_startup();
  console.log("init")
  init();

}

function animateScene() {
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    // This sets background color
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(shaderProgram);

    uResolution =
          gl.getUniformLocation(shaderProgram, "u_resolution");
    uTime =
          gl.getUniformLocation(shaderProgram, "u_time");
    uVol =
          gl.getUniformLocation(shaderProgram, "u_vol");

    gl.uniform2fv(uResolution, resolution);
    gl.uniform1f(uTime, previousTime);
    if (camera && camera.analyser) {
      var bufferLength = camera.analyser.frequencyBinCount;
      var dataArray = new Uint8Array(bufferLength);
  
      camera.analyser.getByteTimeDomainData(dataArray);
      gl.uniform1f(uVol, getRMS(dataArray));
    }
    else{
      gl.uniform1f(uVol, 0.0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    aVertexPosition =
          gl.getAttribLocation(shaderProgram, "aVertexPosition");

    gl.enableVertexAttribArray(aVertexPosition);
    gl.vertexAttribPointer(aVertexPosition, vertexNumComponents,
            gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    window.requestAnimationFrame(function(currentTime) {
      previousTime = previousTime + .005;
      // TODO here check dirty bit and recompile?
      if (isDirty) {
        // recompile and clear dirty bit
        shaderProgram = buildShaderProgram();
        isDirty = false;
      }
      animateScene();
    });

    // console.log("time")
    // console.log(timeSinceStuck + timeElapsedToGetHelp)
    // console.log("cur time")
    // console.log(Date.now())
  
    
  
}

function compileShader(type, code) {
    let shader = gl.createShader(type);

    gl.shaderSource(shader, code);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.log(`Error compiling ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader:`);
          console.log(gl.getShaderInfoLog(shader));
    }
    return shader;
}


function buildShaderProgram() {
  let program = gl.createProgram();
    
  // Compile vertex shader
  let shader = compileShader(gl.VERTEX_SHADER, vertexShader());
  gl.attachShader(program, shader);

  // Compile fragment shader
  shader = compileShader(gl.FRAGMENT_SHADER, fragmentShader());
  gl.attachShader(program, shader);

  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log("Error linking shader program:");
        console.log(gl.getProgramInfoLog(program));
  }

  return program;
}

function webgl_startup() {
  glCanvas = document.getElementById("glcanvas");
  if (glCanvas.width != glCanvas.clientWidth) {
    glCanvas.width = glCanvas.clientWidth;
  }
  if (glCanvas.height != glCanvas.clientHeight) {
    glCanvas.height = glCanvas.clientHeight;
  }
  gl = glCanvas.getContext("webgl");

  shaderProgram = buildShaderProgram();

  aspectRatio = glCanvas.width/glCanvas.height;
  resolution = [glCanvas.width, glCanvas.height];

  vertexArray = new Float32Array([
      -1, 1,
      1, 1,
      1, -1,
      -1, 1,
      1, -1,
     -1, -1
  ]);

  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);

  vertexNumComponents = 2;
  vertexCount = vertexArray.length/vertexNumComponents;

  animateScene();
}


function vertexShader() {
  return _vertexShaderC;
}

function fragmentShader() {
  return _fragmentShader;
}

// add a button that is overlayed over the canvas that calles sendoverwire

/// add html button from javasctipt that calls sendoverwire
// function addSendButton() {
//   var button = document.createElement("button");
//   button.innerHTML = "mix It Up";
//   button.style = "position: absolute; top: 10px; right: 10px; z-index: 1000;";
//   // onclick event with parameter
//   button.onclick = function() {
//     console.log("mixxxie");
//     sendCodeOverWire("mixup");
//   };
//   document.body.appendChild(button);
// }






function sendCodeOverWire(com, code) {
  sentCode = true;
  hasError = false;
  var data = {fs:code, comment:com}
  socket.emit('livecode-update', data);
  
}

// this returns false if the fragment shader cannot compile
// true if it can
function checkFragmentShader(shaderCode, lint = false) {
  if (!gl) {
    return ;
  }
  let shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);
  let infoLog = gl.getShaderInfoLog(shader);
  let result = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  let ret = [];
  if (!result) {
    console.log(infoLog);
    var errors = infoLog.split(/\r|\n/);
    for (let error of errors){
      var splitResult = error.split(":")
      ret.push( {
        message: splitResult[3] + splitResult[4],
        character: splitResult[1],
        line: splitResult[2]

      })
    }
  }
  
  if (result) {
    console.log("did update");
    _fragmentShader = shaderCode;
    isDirty = true;
  }

  return ret;
}



(function(mod) {
  mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

function validator(text, options) {
  var result = [];
  var errors = checkFragmentShader(text, true);
  if (errors) parseErrors(errors, result);
  return result;
}

CodeMirror.registerHelper("lint", "x-shader/x-vertex", validator);

function parseErrors(errors, output) {
  for ( var i = 0; i < errors.length; i++) {
    var error = errors[i];
    if (error) {
      if (Number(error.line) <= 0) {
        console.warn("Cannot display error (invalid line " + error.line + ")", error);
        continue;
      }

      var start = error.character - 1, end = start + 1;


      // Convert to format expected by validation service
      var hint = {
        message: error.message,
        severity: "error",
        from: CodeMirror.Pos(Number(error.line) - 1, start),
        to: CodeMirror.Pos(Number(error.line) - 1, end)
      };

      output.push(hint);
    }
  }
}
});