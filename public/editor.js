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
let m = 0;


let currentShaderIndex = 1;
const urlParams = new URLSearchParams(window.location.search);
const shaderParam = urlParams.get('shader');
const shaders = [_fragmentShaderA, _fragmentShaderB, _fragmentShaderC, _fragmentShaderD];

// Set currentShaderIndex based on URL parameter or default to 2
currentShaderIndex = shaderParam ? parseInt(shaderParam, 10) : 1;

// Ensure currentShaderIndex is within valid range
currentShaderIndex = currentShaderIndex %shaders.length ;


let _fragmentShader = shaders[currentShaderIndex];

let isExpanded = false; // Initialize to false

window.addEventListener('message', (event) => {
  if (event.data.type === 'setup') {
    setupEscapeHandler();
  } else if (event.data.type === 'reset') {
    isExpanded = false;
    updateEditorVisibility();
  }
});

function setupEscapeHandler() {
  document.addEventListener('mousedown', (e) => {
    isExpanded = true;
    updateEditorVisibility();
  })
  
  document.addEventListener('keydown', (e) => {
    console.log("Key pressed:", e.key);
    console.log("isExpanded:", isExpanded);
    
    if (e.key === 'Escape') {
      console.log("Escape key pressed");
      if (isExpanded) {
        isExpanded = false;
        updateEditorVisibility();
        e.preventDefault();
        console.log("Escape pressed while expanded");
        window.parent.postMessage({ type: 'escape' }, '*');
      } else {
        console.log("Escape pressed, but not expanded");
      }
    }
  });
}

function updateEditorVisibility() {
  const editorElement = document.querySelector('.CodeMirror');
  if (editorElement) {
    editorElement.style.display = isExpanded ? 'block' : 'none';
  }
}

// Modify your existing expand function or add this if you don't have one
function expandIframe() {
  isExpanded = true;
  updateEditorVisibility();
  // ... other expand logic ...
}

function setupShaderCycling() {
  // Get the shader index from URL parameter

  
  document.addEventListener('keydown', (event) => {
    if (event.metaKey) { // Command key on Mac, Windows key on Windows
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        currentShaderIndex = (currentShaderIndex - 1 + shaders.length) % shaders.length;
        editor.setValue(shaders[currentShaderIndex]);
        updateShader(shaders[currentShaderIndex]);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        currentShaderIndex = (currentShaderIndex + 1) % shaders.length;
        editor.setValue(shaders[currentShaderIndex]);
        updateShader(shaders[currentShaderIndex]);
      }
    }
  });
}


if (window.isProduction && window.location.protocol !== "https:") {
  window.location = "https://" + window.location.hostname;
}

let button = document.querySelector("button");
setupShaderCycling()

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


let d = 0; // Initialize the global variable d

function setupDToggle() {
  // Keyboard listener
  document.addEventListener('keydown', (event) => {
    if (event.shiftKey && event.key === 'ArrowRight') {

      event.preventDefault();
      d = (message.data[0] == 144);
      m = message.data[0];
    }
  });

  // MIDI listener
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess()
      .then(onMIDISuccess, onMIDIFailure);
  } else {
    console.log("WebMIDI is not supported in this browser.");
  }
}


function onMIDISuccess(midiAccess) {
  for (var input of midiAccess.inputs.values()) {
    input.onmidimessage = onMIDIMessage;
  }
}

function onMIDIFailure(error) {
  console.log("Could not access your MIDI devices: ", error);
}

function onMIDIMessage(message) {
  // Toggle d for every MIDI message received
  //toggleD(message.data[0]);
  d = (message.data[0] == 144);
  m = message.data[0]
  // You can add more specific MIDI handling here if needed
  console.log('MIDI data', message.data[0]);


}

// Call this function to set up the listeners
setupDToggle();

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

  setupEscapeHandler();
  const editorElement = document.querySelector('.CodeMirror');
  if (editorElement) {
    editorElement.style.display = 'none';
  }

  //updateEditorVisibility(); // Hide editor initially
}


// this function will trigger a change to the editor
function onEdit() {
  isExpanded = true;
  updateEditorVisibility();

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
    uDrop =
          gl.getUniformLocation(shaderProgram, "drop");
    uMidi =
          gl.getUniformLocation(shaderProgram, "midi");
     
    gl.uniform2fv(uResolution, resolution);
    gl.uniform1f(uTime, previousTime);
    

    gl.uniform1f(uDrop, d);
    gl.uniform1f(uMidi, m);



    // if (camera && camera.analyser) {
    //   var bufferLength = camera.analyser.frequencyBinCount;
    //   var dataArray = new Uint8Array(bufferLength);
  
    //   camera.analyser.getByteTimeDomainData(dataArray);
    //   gl.uniform1f(uVol, getRMS(dataArray));
    // }
    //else{
      gl.uniform1f(uVol, 0.0);
    //}

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    aVertexPosition =
          gl.getAttribLocation(shaderProgram, "aVertexPosition");

    gl.enableVertexAttribArray(aVertexPosition);
    gl.vertexAttribPointer(aVertexPosition, vertexNumComponents,
            gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
// get teh current frame buffer
// var frameBuffer = gl.createFramebuffer();
// gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
// var texture = gl.createTexture();
// gl.bindTexture(gl.TEXTURE_2D, texture);
// gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, null);
// gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
// //set the texture as previous frame

// uPrev =
// gl.getUniformLocation(shaderProgram, "prev");

// gl.uniform1i(uPrev, texture);

    // save the current frame buffer to texture in the shade
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