var createError = require("http-errors");
const sendMessage = require('./services/gpt');

var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const dotenv = require("dotenv");
dotenv.config();

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");


var app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

// Commented out view engine setup
//app.set("views", path.join(__dirname, "views"));
// app.set('view engine', 'index.html');
// app.engine('html', require('ejs').renderFile);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

console.log(process.env.NODE_ENV);

function extractCode(response) {
  // Use a regular expression to find code blocks
  const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
  const matches = [...response.matchAll(codeBlockRegex)];
  
  if (matches.length > 0) {
    // Extract code blocks
    const codeBlocks = matches.map(match => match[1].trim());
    return codeBlocks[0];
  } else {
    console.log("no code");
    console.log(response);
    return response
    // return `
    // #ifdef GL_ES
    // precision mediump float;
    // #endif
    // uniform vec2 u_resolution;
    // uniform float u_time;
    // void main(void)
    // {
    //     vec2 normCoord = gl_FragCoord.xy/u_resolution;
    //     vec2 uv = -1. + 2. * normCoord;
    //     float r = sin(u_time + uv.x); 
    //   float g = sin(-u_time + uv.y * 20.);
    //   float b = mod(uv.x / uv.y,1.0);
    //     vec4 color = vec4(r,g,b,1);
    //     gl_FragColor = color;
    // }
    // `;
  }
}

if (process.env.NODE_ENV === "development") {
  var livereload = require("livereload");
  var connectLiveReload = require("connect-livereload");

  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(path.join(__dirname, "public"));
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });
  app.use(connectLiveReload());
}

// app.use("/", indexRouter);
app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

const listener = server.listen(process.env.PORT || 3000, function() {
  console.log("Your app is listening on port " + listener.address().port);
});


// app.use("/users", usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Send error response as JSON
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: req.app.get("env") === "development" ? err : {}
  });
});
app.get("/current_code_debug", function(request, response) {
  response.send({_code});
})


let _code = undefined;

io.on("connection", function(socket) {

  socket.on("livecode-update", async function(code) {
    console.log("CODE:",  code);
    // save the code here
    if (code.comment == "mixup"){
      console.log("MIXUP");
      _code = await sendMessage("Send me back the code changed so its more creative, add 5 lines of code that makes it more creative and can compile \n"+code.fs);;


    }
      else{
        console.log("CHANGE");
        _code = await sendMessage("//just send back code in glsl any non-code must be commented like this \n"+code.fs);;

    }
    //if(code.who == process.env.EDITOR){
      // broadcast the code too

      //convert the code to strings concatinated
    
      //send code back to front end code

      //socket.emit("livecode-update", _code);
      _code = extractCode(_code);
      if (_code != undefined){
        socket.emit("code", _code);
      }
      else{
        console.log("No code found");
      }
      
      console.log("RESPONSE UPDATE:",  _code);
    //}
  })

  socket.on("disconnect", function() {
    //
  });
});



const Test = async function() {
  console.log("about to send request");
  const response = await sendMessage("Hello respond counting to 10");
  console.log(response);
};

// console.log("about to test");
//  Test();

//module.exports = app;
