

const w = 1200, h = 800, near = -500, far = 1000, margin = 50
/*
const camera = new THREE.OrthographicCamera( w/- 2, w/2, h/2, h/- 2, near, far );
camera.position.x = w/2;
camera.position.y = h/2;
camera.position.z = 400;
*/
var camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
// camera.position.z = 200;
// camera.position.x = -100;
// camera.position.y = 100;
camera.position.x = w/2
camera.position.y = h/2
camera.position.z = 200//900;


const renderer = new THREE.WebGLRenderer({
    antialias: true
})

console.log(renderer)
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

renderer.setClearColor(0xFFFFFF, 1.0);

const scene = new THREE.Scene();

const scatterPlot = new THREE.Object3D();
scene.add(scatterPlot);

console.log('scatter', scatterPlot)

const PARTICLE_SIZE = 3

const mat = new THREE.PointsMaterial({
    vertexColors: true,
    size: PARTICLE_SIZE
});



// const ambientLight = new THREE.AmbientLight( Math.random() * 0x10 );
// scene.add( ambientLight );

//scatterPlot.rotation.y = 0;
				// Grid

// var size = 500, step = 50;

// var geometry = new THREE.Geometry();

// for ( var i = - size; i <= size; i += step ) {

// 	geometry.vertices.push( new THREE.Vector3( - size, 0, i ) );
// 	geometry.vertices.push( new THREE.Vector3(   size, 0, i ) );

// 	geometry.vertices.push( new THREE.Vector3( i, 0, - size ) );
// 	geometry.vertices.push( new THREE.Vector3( i, 0,   size ) );

// }

// var material = new THREE.LineBasicMaterial( { color: 0x000000, opacity: 0.2 } );

// var line = new THREE.LineSegments( geometry, material );
// scene.add( line );
const pointGeo = new THREE.BufferGeometry();
const points = new THREE.Points(pointGeo, mat);


function addPoints(dataPoints, metaData, xAccessor, yAccessor, metaAccessor) {

	const xScale = d3.scaleLinear()
		.domain(d3.extent(dataPoints, xAccessor))
		.range([margin, w - margin])

	const yScale = d3.scaleLinear()
		.domain(d3.extent(dataPoints, yAccessor))
		.range([margin, h - margin])

    const colorScale = d3.scaleOrdinal(d3.schemeCategory20c)



	const pointCount = dataPoints.length;

	// dataPoints.forEach((point, i) => {
	//     const x = xScale(xAccessor(point));
	//     const y = yScale(yAccessor(point));
	//     const z = 0//zScale(unfiltered[i].z);

	//     pointGeo.vertices.push(new THREE.Vector3(x, y, z));
	//     //pointGeo.vertices[i].angle = Math.atan2(z, x);
	//     //pointGeo.vertices[i].radius = Math.sqrt(x * x + z * z);
	//     //pointGeo.vertices[i].speed = (z / 100) * (x / 100);
	//     pointGeo.colors.push(new THREE.Color().setRGB(255, 0, 0));

	// })
    var positions = new Float32Array(pointCount * 3);
    var colors = new Float32Array(pointCount * 3);
    var alphas = new Float32Array(pointCount);

	for (let i = 0; i < pointCount; i ++) {
	    const x = xScale(xAccessor(dataPoints[i]));
	    const y = yScale(yAccessor(dataPoints[i]));
	    const z = 0//zScale(unfiltered[i].z);

	    
	    //pointGeo.vertices[i].angle = Math.atan2(z, x);
	    //pointGeo.vertices[i].radius = Math.sqrt(x * x + z * z);
	    //pointGeo.vertices[i].speed = (z / 100) * (x / 100);
        const pointColor = colorScale(metaAccessor(metaData ? metaData[i] : 'x'))
        const pointRGB = hexToRgb(pointColor)
        //console.log(metaAccessor(metaData[i]), pointColor, pointRGB, pointRGB.r, pointRGB.g, pointRGB.b)

        // pointGeo.vertices.push(new THREE.Vector3(x, y, z));
	    // pointGeo.colors.push(new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255));

        positions[i * 3 + 0] = x; //x;
        positions[i * 3 + 1] = y; // y;
        positions[i * 3 + 2] = z; //z;

        // colors
        colors[i * 3 + 0] = pointRGB.r;
        colors[i * 3 + 1] = pointRGB.g;
        colors[i * 3 + 2] = pointRGB.b;

        // sizes
        alphas[i] = 10;        

	}
    pointGeo.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeo.addAttribute('color', new THREE.BufferAttribute(colors, 3));
    pointGeo.addAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

	scatterPlot.add(points);
    console.log(points)

	renderer.render(scene, camera);

}

// const q = d3.queue()
//     .defer(d3.json, 'data/word2vec_tsne_2d.json')
//     .defer(d3.json, 'data/word2vec_meta.json')
//     .awaitAll((error, results) => {
//         if (error) {
//             console.log('ERROR', error)
//             throw error;
//         }
//         const tsne = results[0],
//               meta = results[1]
//         console.log(meta[0])
//         console.log(meta[1])
//         console.log(meta[2])
//         addPoints(tsne, meta, d => d.coords[0], d => d.coords[1], m => m.meta.groups[0])
//     })


d3.json('data/word2vec_tsne_2d.json', (data) => {
	console.log(data)
	addPoints(data, null, d => d.coords[0], d => d.coords[1], m => 'x')
})



let sx = 0,
    sy = 0,
    down = false,
    paused = false,
    animating = false

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

    
window.onmousedown = (e) => {
    down = true;
    sx = e.clientX;
    sy = e.clientY;
};
window.onmouseup = () => {
    down = false;
};
window.onmousemove = (e) => {
    if (down) {
        var dx = e.clientX - sx;
        var dy = e.clientY - sy;
        //scatterPlot.rotation.y += dx * 0.01;
        camera.position.x -= dx;
        camera.position.y += dy;
        sx += dx;
        sy += dy;
    }

    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components (for raycasting)
    mouse.x = ( e.clientX / w ) * 2 - 1;
    mouse.y = - ( e.clientY / h ) * 2 + 1;
}
window.ondblclick = () => {
    animating = !animating;
};

document.body.addEventListener( 'mousewheel', mousewheel, false );
document.body.addEventListener( 'DOMMouseScroll', mousewheel, false ); // firefox

const ZOOM_MIN_Z = 50
	  ZOOM_MAX_Z = 1000

function mousewheel(e) {
	let d = ((typeof e.wheelDelta != "undefined")?(-e.wheelDelta):e.detail);
    d = 100 * ((d>0)?1:-1);    
    const cPos = camera.position;
    if (isNaN(cPos.x) || isNaN(cPos.y) || isNaN(cPos.y)) return;

	mb = d>0 ? 1.05 : 0.95;
    const newZ = cPos.z * mb
    if (newZ <= ZOOM_MIN_Z || newZ >= ZOOM_MAX_Z ){
       return ;
    }
    cPos.z = newZ;
}
let frameCount = 0

let INTERSECTED = null

function animate(t) {
    if (!paused) {
        last = t;
        if (animating) {
        	
            var v = pointGeo.vertices;
            for (var i = 0; i < v.length; i++) {
                var u = v[i];
                console.log(u)
                u.angle += u.speed * 0.01;
                u.x = Math.cos(u.angle) * u.radius;
                u.z = Math.sin(u.angle) * u.radius;
            }
            pointGeo.__dirtyVertices = true;

        }
        renderer.clear();
        //console.log(mouse)
        raycaster.setFromCamera( mouse, camera );

        // calculate objects intersecting the picking ray
        var intersects = []
        //intersects = raycaster.intersectObject(points);


        var geometry = points.geometry;
        var attributes = geometry.attributes;

        if(intersects.length) {
            console.log(intersects.length)
        }

        for ( var i = 0; i < intersects.length; i++ ) {
            //console.log('INTERSECTS', intersects)
            // console.log(intersects[i].object, intersects[i].object.children.length)
            // if(intersects[i].object.children.length===0)

            // intersects[ i ].object.material.color.set( 0xff0000 );
            if ( intersects.length > 0 ) {
                    if ( INTERSECTED != intersects[ 0 ].index ) {
                        attributes.size.array[ INTERSECTED ] = PARTICLE_SIZE;
                        INTERSECTED = intersects[ 0 ].index;
                        attributes.size.array[ INTERSECTED ] = PARTICLE_SIZE * 1.25;
                        attributes.size.needsUpdate = true;
                    }
                } else if ( INTERSECTED !== null ) {
                    attributes.size.array[ INTERSECTED ] = PARTICLE_SIZE;
                    attributes.size.needsUpdate = true;
                    INTERSECTED = null;
                }

        }        
        //camera.lookAt(scene.position);
        renderer.render(scene, camera);
    }
    frameCount++
    if(frameCount< 10000)
    window.requestAnimationFrame(animate, renderer.domElement);
};
animate(new Date().getTime());


// from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function hexToRgb(hex) { //TODO rewrite with vector output
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}