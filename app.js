

const w = window.innerWidth, h = window.innerHeight, near = -500, far = 1000, margin = 20
/*
const camera = new THREE.OrthographicCamera( w/- 2, w/2, h/2, h/- 2, near, far );
camera.position.x = w/2;
camera.position.y = h/2;
camera.position.z = 900;
*/
var camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000)
camera.position.x = w/2
camera.position.y = h/2
camera.position.z = 900

let allMetaData;

const dataSetProperties = {
    xAccessor: d => d.coords[0],
    yAccessor: d => d.coords[1],
    colorAccessor: m => m.meta.groups[0]
}

const xScale = d3.scaleLinear()
    .range([margin, w - margin])

const yScale = d3.scaleLinear()
    .range([margin, h - margin])

const colorScale = d3.scaleOrdinal(d3.schemeCategory20c)


let sx = 0,
    sy = 0,
    ssx = 0,
    ssy = 0,
    mouseDown = false,
    shiftDown = false

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

const metaDivEl = document.getElementById('meta'),
      imageEl = document.querySelector('#meta img'),
      titleEl = document.querySelector('#meta .title'),
      categoryEl = document.querySelector('#meta .category'),
      selectionEl = document.getElementById('selection'),
      selectedNodesEl = document.getElementById('selectednodes'),
      controlsEl = document.getElementById('controls'),
      mouseEl = document.getElementById('mouse')


const renderer = new THREE.WebGLRenderer({
    antialias: true
})

renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

renderer.setClearColor(0xFFFFFF, 1.0);

const scene = new THREE.Scene();

const scatterPlot = new THREE.Object3D();
scene.add(scatterPlot);

const PARTICLE_SIZE = 5

const mat = new THREE.PointsMaterial({
    vertexColors: true,
    size: PARTICLE_SIZE
});



const pointGeo = new THREE.Geometry();
const points = new THREE.Points(pointGeo, mat);


function addPoints(dataPoints, metaData, xAccessor, yAccessor, metaAccessor) {

	xScale.domain(d3.extent(dataPoints, xAccessor))

	yScale.domain(d3.extent(dataPoints, yAccessor))

	const pointCount = dataPoints.length;

	for (let i = 0; i < pointCount; i ++) {
	    const x = xScale(xAccessor(dataPoints[i]));
	    const y = yScale(yAccessor(dataPoints[i]));
	    const z = 0//zScale(unfiltered[i].z);

	    pointGeo.vertices.push(new THREE.Vector3(x, y, z));
	    
	    //pointGeo.vertices[i].angle = Math.atan2(z, x);
	    //pointGeo.vertices[i].radius = Math.sqrt(x * x + z * z);
	    //pointGeo.vertices[i].speed = (z / 100) * (x / 100);

        const pointColor = colorScale(metaAccessor(metaData ? metaData[i] : 'x'))
        const pointRGB = hexToRgb(pointColor)

	    pointGeo.colors.push(new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255));

	}
	scatterPlot.add(points);

	renderer.render(scene, camera);

}

//load data

const q = d3.queue()
    .defer(d3.json, 'data/word2vec_tsne_2d.json')
    //.defer(d3.json, 'data/conv2vec_tsne_026.json')
    .defer(d3.json, 'data/word2vec_meta.json')
    .awaitAll((error, results) => {
        if (error) {
            console.log('ERROR', error)
            throw error;
        }
        const tsne = results[0],
              meta = results[1]
        console.log(meta[0], meta.length)
        console.log(tsne[0], tsne.length)
        allMetaData = meta
        createMetaDataOptions()
        addPoints(tsne, meta, 
            dataSetProperties.xAccessor, dataSetProperties.yAccessor, dataSetProperties.colorAccessor)
    })

function createMetaDataOptions() {
    const keys = Object.keys(allMetaData[0].meta)
    controlsEl.innerHTML = keys.map(key => `<option>${key}</option>`)
    controlsEl.selectedIndex = 1
    controlsEl.addEventListener('change', e => {
        console.log(e, e.srcElement.selectedIndex)
        const selectedKey = e.srcElement.selectedIndex
        dataSetProperties.metaAccessor = d => d.meta[keys[selectedKey]]
        changeColors()
    })
}

function changeColors() {

    pointGeo.colors.forEach((color, i) => {
        const metaAccessor = dataSetProperties.metaAccessor
        const metaData = allMetaData
        if(i===0) {
            console.log(metaAccessor.toString())
            console.log(metaAccessor(metaData[i]))
            console.log(metaAccessor(metaData ? metaData[i] : 'x'))
        }
        const pointColor = colorScale(metaAccessor(metaData ? metaData[i] : 'x'))
        const pointRGB = hexToRgb(pointColor)

        pointGeo.colors[i] = new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255);

    })
    points.geometry.colorsNeedUpdate = true
}

// load without metadata. for debugging

// d3.json('data/word2vec_tsne_2d.json', (data) => {
// 	console.log(data)
// 	addPoints(data, null, d => d.coords[0], d => d.coords[1], m => 'x')
// })
function calculateSelection(x, y, width, height) {
    console.log(x, y, width, height)
    // const projector = new THREE.Projector();
    // const pos3D = new THREE.Vector3(x, y, 0)
    // const v = projector.projectVector(pos3D, camera);
    // console.log(v)
    // const selectedNodes = pointGeo.vertices.filter((node) => {
    //     //console.log(node)
    //     return node.x >= x && node.x <= x + width && node.y >= y && node.y <= y + height
    // })
    resetNodeColors(highlightedNodes.filter(node => node.mode === HIGHLIGHT_MODES.SELECTION))
    highlightedNodes = []
    pointGeo.vertices.forEach((node, i) => {
        //console.log(node)
        if(node.x > x && node.x < x + width && node.y > y && node.y < y + height) {
            pointGeo.colors[i] = new THREE.Color().setRGB( .1, .2, .1)
            points.geometry.colorsNeedUpdate = true
            highlightedNodes.push({index: i, mode: HIGHLIGHT_MODES.SELECTION})
        }
    })
    drawSelectedNodes()

    //console.log(selectedNodes.length, selectedNodes)
}

function drawSelectedNodes() {
    let selectedNodesHTML = ''
    highlightedNodes.forEach((node) => {
        if(node.mode===HIGHLIGHT_MODES.SELECTION) {
            if(allMetaData) {
                const metaData = allMetaData[node.index].meta
                selectedNodesHTML = `${selectedNodesHTML} <img src="${metaData.sizes[0].source}">` 
            }

        }
    })
    selectedNodesEl.innerHTML = selectedNodesHTML
}

window.onmousedown = (e) => {
    mouseDown = true;
    sx = e.clientX;
    sy = e.clientY;
    ssx = e.clientX;
    ssy = e.clientY;

}
window.onmouseup = (e) => {
    mouseDown = false;
    if(shiftDown) {
        calculateSelection( ssx,  h - ssy, (sx - ssx), (sy - ssy))
        selectionEl.style.opacity = 0
    }
}


window.onmousemove = (e) => {
    if (mouseDown) {
        var dx = e.clientX - sx;
        var dy = e.clientY - sy;
        //scatterPlot.rotation.y += dx * 0.01;
        sx += dx;
        sy += dy;
        if(shiftDown) {
            selectionEl.style.opacity = 1
            selectionEl.style.top = Math.min(ssy, sy)
            selectionEl.style.left = Math.min(ssx, sx)
            selectionEl.style.width = Math.abs(ssx - sx)+'px'
            selectionEl.style.height = Math.abs(ssy - sy)+'px'
        }   
        else {
            camera.position.x -= dx;
            camera.position.y += dy;

        }     
    }

    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components (for raycasting)
    mouse.x = ( e.clientX / w ) * 2 - 1;
    mouse.y = - ( e.clientY / h ) * 2 + 1;

    mouseEl.innerText = e.clientX + ' ' + e.clientY
    mouseEl.style.top = e.clientY
    mouseEl.style.left = e.clientX
}

window.addEventListener('keydown', (e) => {
   if(e.keyCode===16) {
        shiftDown = true
   }
})

window.addEventListener('keyup', (e) => {
   if(e.keyCode === 16) {
        shiftDown = false
   }
})


window.addEventListener( 'mousewheel', mousewheel, false );
window.addEventListener( 'DOMMouseScroll', mousewheel, false ); // firefox

const ZOOM_MIN_Z = 100
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

let prevHighlight = {}
let highlightedIndex = -1

let highlightedNodes = []
const HIGHLIGHT_MODES = {HOVER: 'hover', SELECTION: 'selection'}

function animate(t) {
    //last = t;
    renderer.clear();
    //console.log(mouse)
    raycaster.setFromCamera( mouse, camera );

    // calculate objects intersecting the picking ray
    var intersects = []
    intersects = raycaster.intersectObjects(scene.children, true);


    // just higlight one point!!!
    for ( var i = 0; i < Math.min(intersects.length, 1); i++ ) {

        

        const intersect = intersects[0]
        const index = intersect.index


        // Object.keys(prevHighlight).forEach(indexKey => {
        //     if(indexKey!==index) {
        //         pointGeo.colors[indexKey] = prevHighlight[indexKey]
        //         delete prevHighlight[indexKey]
        //     }
        // })
    
        //to change back the color
        const nodesNoLongerHighlighted = highlightedNodes.filter((node) => node.index!==index && node.mode===HIGHLIGHT_MODES.HOVER)
        resetNodeColors(nodesNoLongerHighlighted)

        //remove previously hovered nodes
        highlightedNodes = highlightedNodes.filter((node) => node.mode!=HIGHLIGHT_MODES.HOVER)

        highlightedNodes.push({index: index, mode: HIGHLIGHT_MODES.HOVER})


        // if(!prevHighlight[index]) {
        //     prevHighlight[index] = pointGeo.colors[index]
        // }


        pointGeo.colors[index] = new THREE.Color().setRGB( 0, 0 , 0)
        points.geometry.colorsNeedUpdate = true

        const highlightPosition = pointGeo.vertices[index]
        highlightPosition.z = 1
        pointGeo.vertices[index] = highlightPosition
        pointGeo.verticesNeedUpdate = true


        if(allMetaData && !shiftDown) {
            const metaData = allMetaData[index].meta
            imageEl.setAttribute('src', metaData.sizes[1].source)
            titleEl.innerText = metaData.title
            categoryEl.innerText = metaData.groups.join(', ')
            metaDivEl.style.top =  - (mouse.y - 1)/2 * h + 5
            metaDivEl.style.left = (mouse.x + 1)/2 * w + 5
            metaDivEl.style.opacity = 1

        }


    }
    if(intersects.length==0) {

        const nodesNoLongerHighlighted = highlightedNodes.filter((node) => node.mode===HIGHLIGHT_MODES.HOVER)
        resetNodeColors(nodesNoLongerHighlighted)


        // Object.keys(prevHighlight).forEach(indexKey => {
        //     pointGeo.colors[indexKey] = prevHighlight[indexKey]
        //     delete prevHighlight[indexKey]
        //     points.geometry.colorsNeedUpdate = true
        // })
        // highlightedIndex = -1

        metaDivEl.style.opacity = 0



    }       
    //camera.lookAt(scene.position);
    renderer.render(scene, camera);

    window.requestAnimationFrame(animate, renderer.domElement);
};
animate()//new Date().getTime());

function resetNodeColors(nodesNoLongerHighlighted) {

    nodesNoLongerHighlighted.forEach((node) => {

        const pointColor = colorScale(dataSetProperties.colorAccessor(allMetaData ? allMetaData[node.index] : 'x'))
        const pointRGB = hexToRgb(pointColor)
        pointGeo.colors[node.index] = new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255)

        const highlightPosition = pointGeo.vertices[node.index]
        highlightPosition.z = 0
        pointGeo.vertices[node.index] = highlightPosition
        pointGeo.verticesNeedUpdate = true


    })

}

// from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function hexToRgb(hex) { //TODO rewrite with vector output
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}