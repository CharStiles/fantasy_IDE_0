const _fragmentShaderC = `
#ifdef GL_ES
precision mediump float;
#endif
uniform vec2 u_resolution;
uniform float u_time;
void main(void)
{
    vec2 normCoord = gl_FragCoord.xy/u_resolution;
    vec2 uv = -1. + 2. * normCoord;
    float r = sin(u_time + uv.x); 
	float g = sin(-u_time + uv.y * 20.);
	float b = mod(uv.x / uv.y,1.0);
    vec4 color = vec4(r,g,b,1);
    gl_FragColor = color;
}
`;

const _vertexShaderC = `
attribute vec2 aVertexPosition;

void main() {
  gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}

`;

