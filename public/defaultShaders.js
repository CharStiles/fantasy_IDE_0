const _fragmentShaderC = `

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_vol;
uniform float drop;
uniform float midi;
#define PI 3.14159265
#define TAU (2*PI)
#define PHI (sqrt(5)*0.5 + 0.5)

const int steps = 32; // This is the maximum amount a ray can march.
const float smallNumber = 0.1;
const float maxDist = 50.; // This is the maximum distance a ray can travel.
float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}
float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}
vec3 cosPalette( float t , vec3 brightness, vec3 contrast, vec3 osc, vec3 phase)
{

    return brightness + contrast*cos( 6.28318*(osc*t+phase) );
}

 void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}
float smoothMod(float axis, float amp, float rad){
    float top = cos(PI * (axis / amp)) * sin(PI * (axis / amp));
    float bottom = pow(sin(PI * (axis / amp)), 2.0) + pow(rad, 2.0);
    float at = atan(top / bottom);
    return amp * (1.0 / 2.0) - (1.0 / PI) * at;
}
vec3 smoothMod(vec3 axis, vec3 amp, float rad){
    vec3 top = cos(PI * (axis / amp)) * sin(PI * (axis / amp));
    float powx = pow(sin(PI * (axis.x / amp.x)), 2.0);
    float powy = pow(sin(PI * (axis.y / amp.y)), 2.0);
    float powz = pow(sin(PI * (axis.z / amp.z)), 2.0);

    vec3 bottom = vec3(powx,powy,powz) + pow(rad, 2.0);
    vec3 at = atan(top / bottom);
    return amp * (1.0 / 2.0) - (1.0 / PI) * at;
}

// Same, but mirror every second cell at the diagonal as well
vec2 pModGrid2(inout vec2 p, vec2 size) {
    vec2 c = floor((p + size*0.5)/size);
    p = mod(p + size*0.5, size) - size*0.5;
    p *= mod(c,vec2(2))*2. - vec2(1);
    p -= size/2.;
    if (p.x > p.y) p.xy = p.yx;
    return floor(c/2.);
}
float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}
vec3 rotateQuat( vec4 quat, vec3 vec )
{
return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );
}
float random (vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

vec3 lookAt(vec2 uv, vec3 camOrigin, vec3 camTarget){
    vec3 zAxis = normalize(camTarget - camOrigin);
    vec3 up = vec3(0,1,0);
    vec3 xAxis = normalize(cross(up, zAxis));
    vec3 yAxis = normalize(cross(zAxis, xAxis));
    
    float fov = .5;
    
    vec3 dir = (normalize(uv.x * xAxis + uv.y * yAxis + zAxis * fov));
    
    return dir;
}
    // Helper function for capsule SDF (for bonds)
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sphere(vec3 p) {
  float l = length(p) ;
    return l - 0.1 ;
}
// Hexagonal prism, circumcircle variant
float fHexagonCircumcircle(vec3 p, vec2 h) {
    vec3 q = abs(p);
    return max(q.y - h.y, max(q.x*sqrt(3.)*0.5 + q.z*0.5, q.z) - h.x);
    //this is mathematically equivalent to this line, but less efficient:
    //return max(q.y - h.y, max(dot(vec2(cos(PI/3), sin(PI/3)), q.zx), q.z) - h.x);
}

// Hexagonal prism, incircle variant
float fHexagonIncircle(vec3 p, vec2 h) {
    return fHexagonCircumcircle(p, vec2(h.x*sqrt(3.)*0.5, h.y));
}


float sdLink( vec3 p, float le, float r1, float r2 )
{
  vec3 q = vec3( p.x, max(abs(p.y)-le,0.0), p.z );
  return length(vec2(length(q.xy)-r1,q.z)) - r2;
}
float scene3(vec3 position) {
    vec3 c = mix(vec3(13,14,12),vec3(9,9,3),drop);
  vec2 c2 = c.xy;
  position.z = mod(position.z,c.z) - c.z*0.5;
 //position.xy = mod(position.xy,c2) - (c2*0.5);
   pModGrid2(position.xy,c.xy);
  
    // Bounding box
    vec3 bounds = vec3(5.0, 5.0, 5.0);
    vec3 q = abs(position) - bounds;
    float boundingBox = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

    // Base
    float base = position.y ;

    // Central sphere
    float centralSphere = sphere(position);

    // Hexagonal prisms
    float time = u_time * 0.5;
    vec3 p1 = position;
    pR(p1.xy, time);
    float hex1 = fHexagonIncircle(p1, vec2(0.1, 2.0));

    vec3 p2 = position;
    pR(p2.yz, time * 1.2);
    float hex2 = fHexagonIncircle(p2, vec2(0.08, 1.8));

    vec3 p3 = position;
    pR(p3.xy, time * 0.8);
    float hex3 = fHexagonIncircle(p3, vec2(0.12, 2.2));

    // Combine elements
    float sculpture = smin(centralSphere, hex1, 0.1);
    sculpture = smin(sculpture, hex2, 0.1);
    sculpture = smin(sculpture, hex3, 0.1);
    sculpture = max(sculpture, base);

    // Ensure the sculpture stays within bounds
    return max(sculpture, boundingBox);
}
float scene(vec3 position) {

    
  vec3 c = mix(vec3(13,14,12),vec3(9,9,3),drop);
  vec2 c2 = c.xy;
  position.z = mod(position.z,c.z) - c.z*0.5;
 //position.xy = mod(position.xy,c2) - (c2*0.5);
   pModGrid2(position.xy,c.xy);
   
    float moleculeScale = 2.0;
    position /= moleculeScale;

    float atomRadius = 0.3;
    float bondRadius = 0.08;
    float bondLength = 0.7;

    // Define atom positions
    vec3 atom1 = vec3(0.0, 0.0, 0.0);
    vec3 atom2 = vec3(bondLength, 0.0, 0.0);
    vec3 atom3 = vec3(bondLength * cos(PI/3.0), bondLength * sin(PI/3.0), 0.0);
    vec3 atom4 = vec3(0.0, 0.0, bondLength);

    // Rotate the entire molecule
    pR(position.xy, u_time * 0.5);
    pR(position.xz, u_time * 0.3);

    // Atoms (spheres)
    float d_atom1 = length(position - atom1) - atomRadius;
    float d_atom2 = length(position - atom2) - atomRadius;
    float d_atom3 = length(position - atom3) - atomRadius;
    float d_atom4 = length(position - atom4) - atomRadius;

    // Bonds (cylinders)
    float d_bond1 = sdCapsule(position, atom1, atom2, bondRadius);
    float d_bond2 = sdCapsule(position, atom1, atom3, bondRadius);
    float d_bond3 = sdCapsule(position, atom1, atom4, bondRadius);

    // Combine all elements using smooth min
    float s = 0.1; // Adjust for smoother or sharper blending
    float molecule = smin(d_atom1, d_atom2, s);
    molecule = smin(molecule, d_atom3, s);
    molecule = smin(molecule, d_atom4, s);
    molecule = smin(molecule, d_bond1, s);
    molecule = smin(molecule, d_bond2, s);
    molecule = smin(molecule, d_bond3, s);

    return molecule * moleculeScale;
}


float scene2(vec3 position){
      float three = 3. * 127. + 3.;
    float b = 9.0;//1.- texture2D(midi,midiCoord(three)).w;
    
  vec3 c = mix(vec3(13,14,12),vec3(9,9,3),drop);
  vec2 c2 = c.xy;
  position.z = mod(position.z,c.z) - c.z*0.5;
 //position.xy = mod(position.xy,c2) - (c2*0.5);
   pModGrid2(position.xy,c.xy);
  //position.z = clamp(smoothMod(position.z,c.x,0.0002)-(c.x*0.5), 0.,c.x);
    // position = smoothMod(position,c,0.02) - (c*0.5);

  pR(position.xy, u_time* b *0.1); 
  float len = 9.;//*(sin(time* b*0.4)+1.0) ;
  float wid = .001 ;
  vec3 p = position;
  pR(p.xz, u_time*0.4);
 float h = fHexagonIncircle(p, vec2(wid,len));
  
vec3 p2 = position;
  pR(p2.xy, u_time/20.);
  
  float h2= fHexagonIncircle(p2, vec2(wid,len));
  
  vec3 p3 = position;
  pR(p3.xy, (-u_time + tan(position.z*10.))/20.);
  float h3= fHexagonIncircle(p3, vec2(wid,len));
  
    vec3 p4 = position;
    pR(p4.xy, PI*.9);
    float h4= fHexagonIncircle(p4, vec2(wid,len));

  
float s = ((cos(u_time*0.4 )+1.0)+1.)*1.
;    return smin(smin(smin(h,h2,s),h3,s),h4,s);
}
 
 vec3 estimateNormal(vec3 p) {
    float smallNumber = 0.002;
    vec3 n = vec3(
    scene(vec3(p.x + smallNumber, p.yz)) -
    scene(vec3(p.x - smallNumber, p.yz)),
    scene(vec3(p.x, p.y + smallNumber, p.z)) -
    scene(vec3(p.x, p.y - smallNumber, p.z)),
    scene(vec3(p.xy, p.z + smallNumber)) -
    scene(vec3(p.xy, p.z - smallNumber))
);
// poke around the point to get the line perpandicular
// to the surface at p, a point in space.
return normalize(n);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 lighting2(vec3 pos, vec3 viewDir, float i){

    vec3 lightPos = vec3(cos(u_time)*0.23,0.3,sin(u_time)*0.2 -i);
    // light moves left to right
    vec3 normal = estimateNormal(pos);
    vec3 reflectDir = reflect(-lightPos, normal); 
    float diffuse = max(0., dot(lightPos, normal));
        float specularStrength =5500. ;
    vec3 specColor = hsv2rgb( vec3((((pos.y)*tan(pos.x)*10.)/normal.z )/700.,normal.x,.041));
    float spec = pow( max(dot(viewDir, reflectDir), -1.980), 5.);
    vec3 specular = specularStrength * spec * specColor;
  vec4 spec4 = vec4(specular+ specColor,1.);
    vec4 ret =   diffuse + mix(vec4(pow(0.3,(i/float(steps) * 5.))), spec4, clamp(spec4*2.,0.,1.)) + spec4*0.5;
    return ret;// smoothstep(0.,1.,ret);
}
vec4 trace (vec3 origin, vec3 direction){
    
    float dist = 0.;
    float totalDistance = 0.;
    vec3 positionOnRay = origin;
    
    for(int i = 0 ; i < steps; i++){
        
        dist = scene(positionOnRay);

        positionOnRay += dist * direction;// + (random(positionOnRay.xz)* 0.1);//(.3* sin(u_time*0.5))) ;
        
   
        totalDistance += dist;
        
        if (dist < smallNumber){
    
            return lighting2(positionOnRay, direction, float(i)/100.0) * (1. - (vec4(totalDistance) / maxDist));
 
        }
        
        if (totalDistance > maxDist){
 
            return vec4(00,0,0,1); 
        }
    }
    
    return vec4(0,0,0,1);
}
 

// main is a reserved function that is going to be called first
void main(void)
{
    vec2 normCoord = gl_FragCoord.xy/u_resolution;
    
    float time = u_time/5.0; //slow down time

    vec2 uv = -1. + 2. * normCoord;
// Unfortunately our screens are not square so we must account for that.
    uv.x *= (u_resolution.x / u_resolution.y);
    
    pR(uv, time*0.05 * ( 8.));
    vec3 camOrigin = vec3(-3., 0.3,u_time * (1.0+(7.0)) );
    
    vec3 zAxis = vec3(0,0,1);
    vec3 up = vec3(0,1,0);
    vec3 xAxis = normalize(cross(up, zAxis));
    vec3 yAxis = normalize(cross(zAxis, xAxis));

    // we need to apply rotate 3 times each with rotation on the relative object, 
    // then we can get the lookat direction that we need. SO lets start with looking at forward
vec3 dirToLook = vec3(0,1,1);
    vec3 dir = lookAt(uv, camOrigin, dirToLook);
    vec4 ret = max(trace(camOrigin, dir),0.16);
    vec3 brightness = vec3( 0.5, 0.5, 0.5);
    vec3 contrast = vec3(.5, 0.5, 0.5);
    vec3 osc = vec3( 1.0, 1.0, 1.0) / random(uv*.0001)*2.;
    vec3 phase = vec3(  0.00, 0.10, 0.20);
    vec4 n = ret - noise(vec3(uv, time*0.3));
    ret *= vec4(cosPalette(n.y, brightness, contrast, osc, phase),1.);
    
    gl_FragColor = mix(ret,vec4(0),
                       clamp(  (normCoord.x*8.)-7.,0.,1. 
                            )
                      );
}




`;

const _fragmentShaderB = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec4 u_camRot;
uniform vec4 u_camQuat;
uniform vec3 u_camPos;
uniform float u_vol;
uniform float drop;
uniform sampler2D u_feed;
uniform float midi;

 
// main is a reserved function that is going to be called first
vec4 getScene(vec2 normCoord)
{
   //vec2 v_texcoord = gl_FragCoord.xy/u_resolution;

    vec2 uv = -1. + 2. * normCoord;
  	//float angle = atan(uv.y,uv.x);
  	//uv.x += sin(angle + u_time/2.);
  
    // Unfortunately our screens are not square so we must account for that.
    uv.x *= (u_resolution.x / u_resolution.y);
    
      //  vec2 uv = -1. + 2. * v_texcoord;
    float angle = sin(atan(uv.y,uv.x)+u_time);
    float r = sin( length(angle+uv)*10.);
    return vec4(r);
}


 void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}


float lissajous(vec2 pos, float prog, float a, float b){

    pos= pos*2. -0.7;
    pos*=01.2;
    float rez = 4.;
    pos = floor(pos * rez ) / rez;
  
  float progC = (200.*(prog));
  float v = 0.0;
  for (int i = 0; i < (200*int(12)); i++) {
    
    if(progC <= 0.){
    	break;
    }
    else{
    	progC=progC-1.;
    }
    
    float s = float(i) * 0.0075;
    vec2 mpos = 0.8 * vec2(sin(s * a), - cos(s * b));
    float t = 0.01 / length(mpos - pos);
    v += (pow(t, 2.50) * float(i + 1) / 100.0);

    
  }

  return floor(v+0.6);

}


float sinN(float x){
    return (sin(x)+1.0)/2.;
}

float clamp01(vec4 x){

return clamp(x.x,0.,1.);
}



void main(void)
{
  float pixelation = 8.;
  vec2 v_texcoord = gl_FragCoord.xy/u_resolution;
    vec2 fragCoord = gl_FragCoord.xy/float(pixelation);
    vec2 uv = fragCoord.xy;
    float rez =4.;
    vec2 normCenterSmooth = (v_texcoord-0.5) * 2.;
    vec2 samp = (floor(uv/rez)*rez+(0.5/float(pixelation)))/(u_resolution.xy / float(pixelation));
    
    float centerF = clamp((length(normCenterSmooth) *0.5),0.,1.);
    vec2 coord = v_texcoord - (normCenterSmooth*0.1)* centerF;
    //vec4 prevFrameColOffset = getScene() ;
    vec2 p = fract((v_texcoord )*u_resolution * 0.125 * 0.25);
    //vec4 pcol = texture2D(prevPass,cursor_position);
    vec4 pcol = getScene(samp);//texture2D(prevPass,samp);

    float angle = atan(normCenterSmooth.x,normCenterSmooth.y);
  
    float fade = .7;// * sinN(4.52 +sin(time)*0.01)

    float gray = pow((pcol.r+pcol.g+pcol.b)/3.,fade);
    
    
        float n =  0.0;             // .
    if (gray > 0.2) n = 0.0;    // :
    if (gray > 0.3) n = 112.0;   // *
    if (gray > 0.4) n = 1121212.0; // o 
    if (gray > 0.5) n = 23385164.0; // &
    if (gray > 0.6) n = 15252014.0; // 8
    if (gray > 0.9) n = 13199452.0; // @
    if (gray > 0.999) n = 11512830.0; // #
    
    vec4 symbol = vec4(lissajous(p,gray*2.,mod(gray*8. , 10.)/2. , mod(gray*8., 6.) ));
    vec4 ret = mix(symbol,pcol,drop);
    ret.a = 1.;
    gl_FragColor = mix(ret,vec4(0),
    clamp(  (v_texcoord.x*8.)-7.,0.,1. 
         )
   );
}
`;


const _fragmentShaderA = `



#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_vol;
uniform float drop;
uniform float midi;

const float PI          = 3.14159265359;
const float PI2         = 6.28318530718;
const float MAX_DIST    = 100.;
const float MIN_DIST    = .001;
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}


float hash21(vec2 p) 
{  
    return fract(sin(dot(p, vec2(27.609, 57.583)))*43758.5453); 
}
mat2 rot(float a)
{
    return mat2(cos(a),sin(a),-sin(a),cos(a));
}

float box( vec3 p, vec3 b ){
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float torus( vec3 p, vec2 t )
{
    vec2 q = vec2(length(p.xy)-t.x,p.z);
    return length(q)-t.y;
}

vec3 hp,hitPoint;
mat2 rt;

vec2 map(vec3 p)
{
  float time = u_time* mix(1.,4.,drop);
    vec2 res = vec2(1e5,0.);
    vec3 q = p+vec3(0,0,1);
    vec3 q3=q;
    
    float bf = box(q3,vec3(55., 35.0, 25.));
    float cx = box(q3,vec3(8.35,5.25, 60.));
    bf = max(bf,-cx );
    
    if(bf<res.x) {
        res = vec2(bf,1.);
        hp=q3;
    }
    
    //spheres
    float qd = floor((q3.z+1.5)/3.);
    q3.z=mod(q3.z+1.5,3.)-1.5;
    
    float rdx = .65+.2*sin(qd+time*1.25);
    float ddx = (rdx*2.)-1.;
    float b = length(q3-vec3(0,(rdx*.5)+ddx,0))-rdx;
    if(b<res.x) {
        res = vec2(b,2.);
        hp=q;
    }
    //boxes
    vec3 qr = q-vec3(rdx,ddx,0);
    float id = floor((qr.z+1.5)/3.);
    qr.xy*=rot(time*.3+id*.1);
   
    qr.z=mod(qr.z+1.5,3.)-1.5;
    qr.zx*=rot(time*.5+id*.2);
     
    float bx = box(qr,vec3(.5,.5,.5));
    if(bx<res.x) {
        res = vec2(bx,2.);
        hp=q;
    }
    //rings
    vec3 nq = q;
    float nd = floor((nq.z+1.5)/3.);
    nq.z=mod(nq.z+1.5,3.)-1.5;
    mat2 rota =rot(time*.3+ddx);
    mat2 rotb =rot(time*.2+nd*.5);
    
    nq.yz*=rota;
    nq.xz*=rotb;
    float tr = torus(nq,vec2(.95 ,.15));
    nq.yz*=rota;
    nq.xz*=rotb;
    tr = min(tr, torus(nq,vec2(.45 ,.15)) );
    if(tr<res.x) {
        res = vec2(tr,2.);
        hp=q;
    }
    float f = p.y+(sin(q.x) + cos(q.z))*0.2+2.5;
    if(f<res.x) {
        res = vec2(f,1.);
        hp=p;
    }
    
    
    res = mix(vec2(tr,2.),vec2(bx,2.),(sin(time)+1.0)/2.);
    //res = mix(res, vec2(b,2.), sin(time));
    
   


    return res + rand(q.xz)*0.001;
}

vec3 normal(vec3 p, float t)
{
    t*=MIN_DIST;
    float d = map(p).x;
    
    vec2 e = vec2(t,0);
    vec3 n = d - vec3(
        map(p-e.xyy).x,
        map(p-e.yxy).x,
        map(p-e.yyx).x
        );
    return normalize(n);
}

const vec3 c = vec3(0.959,0.970,0.989),
           d = vec3(0.651,0.376,0.984);
           
vec3 hue(float t){ 
    return .5 + .45*cos(13.+PI2*t*(c*d) ); 
}

void main(void )
{
      vec2 normCoord = gl_FragCoord.xy/u_resolution;
    
    float time = u_time/5.0; //slow down time

    rt = rot(time*.5);
    vec3 C = vec3(0),
         FC = vec3(0.800,0.792,0.659);

    vec2 uv = (2.*gl_FragCoord.xy-u_resolution.xy)/max(u_resolution.x,u_resolution.y);
    
    vec3 ro = vec3(0,0,4.25),
         rd = normalize(vec3(uv,-1));

    float x = 0.;1. + sin(time*0.5)*0.421;
    float y = 0.;tan(time*0.5)*0.421;
    
    
    mat2 rx = rot(y);
    mat2 ry = rot(x);
    
    ro.zy*=rx;ro.xz*=ry;
    rd.zy*=rx;rd.xz*=ry;
    
    float d = 0.01, m = 0.;
    float bnc = 0.;
    vec3 p = ro + rd;
    
    for(int i=0;i<64;i++)
    {
        vec2 ray = map(p);
        d += ray.x;
        m = ray.y;
        p += rd * ray.x * .76;
        if(d>MAX_DIST)break;
        
        if(abs(ray.x)< .0005)
        {
            if(m ==2. && bnc<4.)
            {
                bnc+=1.;
                rd = reflect(rd,normal(p,d));
                p +=rd*.001;
            } 
        }
    }
    
    hitPoint=hp;
    // draw on screen
    if(d<MAX_DIST)
    {
        vec3 n = normal(p,d);
 
        vec4 h = vec4(.5);
        if(m==1.)
        {
            hitPoint.z-=time*1.5;
            hitPoint*=.45;
            vec3 id=floor(hitPoint)-.5;
            vec3 f= fract(hitPoint)-.5;
            vec3 clr = hue(hash21(id.xz)*.2);
            h = vec4(0,0,0,1);
        
        }
        if(m==3.) h.rgb=hue(49.);
        
        vec3 lpos = vec3(3.*sin(time*.4),10,5);
        vec3 l = normalize(lpos-p);
 
        // shading and shadow
        float diff = clamp(dot(n,l),0.,1.);
        float shadow = 0.;
        for(int i=0;i<8;i++)
        {
            vec3 q = (p + n * .2) + l * shadow;
            float h = map(q).x;
            if(h<MIN_DIST*d||shadow>MAX_DIST)break;
            shadow += h;
        }
        
        if(shadow < length(p -  lpos)) diff *= .1;

        //specular 
        vec3 view = normalize(p - ro);
        vec3 ref = reflect(normalize(lpos), n);
        float spec =  0.85 * pow(max(dot(view, ref), 0.), h.w);

        C += mix(h.rgb,l,drop) * diff + spec ;

  
    }
 
    vec4 ret = vec4(pow(C, vec3(01.9)),0.8);
      
    gl_FragColor = mix(ret,vec4(0),
                       clamp(  (normCoord.x*8.)-7.,0.,1. 
                            )
                      );
}








`

const _vertexShaderC = `
attribute vec2 aVertexPosition;

void main() {
  gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}

`;

