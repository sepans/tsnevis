

const w = window.innerWidth, h = window.innerHeight, near = -500, far = 1000, margin = 20

let highlightedNodes = []
const HIGHLIGHT_MODES = {HOVER: 'hover', SELECTION: 'selection'}

const ZOOM_MIN_Z = 100
      ZOOM_MAX_Z = 1000

const camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000)
camera.position.x = w/2
camera.position.y = h/2
camera.position.z = 900


const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const mouseStart = new THREE.Vector2()

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

let allCoords;
let allMetaData;

const dataSetProperties = {
    idAccessor: d => d.id,
    metaDataAccessor: d => d.meta,
    xAccessor: d => d.coords[0],
    yAccessor: d => d.coords[1],
    colorAccessor: m => m ? m.groups[0] : 'n/a',
    imageAccessor: m => m ? m.sizes[1].source : 'n/a'
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


const metaDivEl = document.getElementById('meta'),
      imageEl = document.querySelector('#meta img'),
      titleEl = document.querySelector('#meta .title'),
      categoryEl = document.querySelector('#meta .category'),
      selectionEl = document.getElementById('selection'),
      selectedNodesEl = document.getElementById('selectednodes'),
      controlsEl = document.getElementById('controls'),
      mouseEl = document.getElementById('mouse')



function addPoints(dataPoints, metaData, idAccessor, xAccessor, yAccessor, colorAccessor) {

	xScale.domain(d3.extent(dataPoints, xAccessor))

	yScale.domain(d3.extent(dataPoints, yAccessor))

	const pointCount = dataPoints.length //37107

	for (let i = 0; i < pointCount; i ++) {
        const id = idAccessor(dataPoints[i])
	    const x = xScale(xAccessor(dataPoints[i]));
	    const y = yScale(yAccessor(dataPoints[i]));
	    const z = 0//zScale(unfiltered[i].z);

	    pointGeo.vertices.push(new THREE.Vector3(x, y, z));
	    
	    //pointGeo.vertices[i].angle = Math.atan2(z, x);
	    //pointGeo.vertices[i].radius = Math.sqrt(x * x + z * z);
	    //pointGeo.vertices[i].speed = (z / 100) * (x / 100);
        const pointColor = colorScale(colorAccessor(metaData ? metaData[id] : 'x'))
        const pointRGB = UTILS.hexToRgb(pointColor)

	    pointGeo.colors.push(new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255));

	}
	scatterPlot.add(points);

	renderer.render(scene, camera);

}

//load data

const q = d3.queue()
    //.defer(d3.json, 'data/word2vec_tsne_2d.json')
    .defer(d3.json, 'data/conv2vec_tsne_026.json')
    .defer(d3.json, 'data/word2vec_meta_short.json')
    .awaitAll((error, results) => {
        if (error) {
            console.log('ERROR', error)
            throw error;
        }
        const tsne = results[0],
              meta = results[1]
        console.log(meta[0], meta.length)
        console.log(tsne[0], tsne.length)
        allMetaData = UTILS.createMetaDataMap(results[1], 
                        dataSetProperties.idAccessor, dataSetProperties.metaDataAccessor)
        allCoords = tsne
        UTILS.createMetaDataMap(meta, 
                        dataSetProperties.idAccessor, dataSetProperties.metaDataAccessor)
        createMetaDataOptions()
        addPoints(tsne, allMetaData, 
            dataSetProperties.idAccessor,
            dataSetProperties.xAccessor, dataSetProperties.yAccessor,
            dataSetProperties.colorAccessor)
    })


function createMetaDataOptions() {
    const keys = Object.keys(getMetaDataByIndex(0))
    controlsEl.innerHTML = keys.map(key => `<option>${key}</option>`)
    controlsEl.selectedIndex = 1
    controlsEl.addEventListener('change', (e) => {
      colorOptionChanged(e.srcElement.selectedIndex, keys)  
    }) 
}

function colorOptionChanged(index, keys) {

    dataSetProperties.colorAccessor = d => d ? d[keys[index]] : 'n/a'
    changeColors(true)
}

function changeColors(setNeedUpdate) {

    pointGeo.colors.forEach((color, i) => {
        const colorAccessor = dataSetProperties.colorAccessor
        const metaData = allMetaData
        const pointColor = colorScale(colorAccessor(getMetaDataByIndex(i)))
        const pointRGB = UTILS.hexToRgb(pointColor)

        pointGeo.colors[i] = new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255);

    })
    if(setNeedUpdate) {
        points.geometry.colorsNeedUpdate = true
    }
}

function getMetaDataByIndex(index) {
    return allMetaData[dataSetProperties.idAccessor(allCoords[index])]
}

function getIdByIndex(index) {
    return dataSetProperties.idAccessor(allCoords[index])
}

// load without metadata. for debugging

// d3.json('data/word2vec_tsne_2d.json', (data) => {
// 	console.log(data)
// 	addPoints(data, null, d => d.coords[0], d => d.coords[1], m => 'x')
// })
function calculateSelection() {


    const topLeft = intersectWithBackPlane(mouseStart)
    const bottomRight = intersectWithBackPlane(mouse)

    resetNodeColors(highlightedNodes.filter(node => node.mode === HIGHLIGHT_MODES.SELECTION))
    highlightedNodes = []
    pointGeo.vertices.forEach((node, i) => {

        if((node.x - topLeft.x > 0 && node.x - bottomRight.x < 0 || node.x - topLeft.x < 0 && node.x - bottomRight.x > 0) &&
           (node.y - topLeft.y > 0 && node.y - bottomRight.y < 0 || node.y - topLeft.y < 0 && node.y - bottomRight.y > 0) ) {
            const pointColor = pointGeo.colors[i]
            pointColor.setRGB(pointColor.r * 0.6 , pointColor.g * 0.6 , pointColor.b * 0.6 )
            points.geometry.colorsNeedUpdate = true
            highlightedNodes.push({index: i, mode: HIGHLIGHT_MODES.SELECTION})
        }
    })

 
    drawSelectedNodes()

 }

 const backgroundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

// finds the intersection between ray and background flat plane
function intersectWithBackPlane(vector2) {
    
    raycaster.setFromCamera( vector2, camera );
    return raycaster.ray.intersectPlane(backgroundPlane)
}

function drawSelectedNodes() {
    let selectedNodesHTML = ''
    highlightedNodes.forEach((node) => {
        if(node.mode===HIGHLIGHT_MODES.SELECTION) {
            if(allMetaData) {
                const nodeMetaData = getMetaDataByIndex(node.index)
                selectedNodesHTML = `${selectedNodesHTML} <img __data_id="${getIdByIndex(node.index)}" __data_index="${node.index}" src="${dataSetProperties.imageAccessor(nodeMetaData)}">` 
            }

        }
    })
    selectedNodesEl.innerHTML = selectedNodesHTML;

    //setTimeout(() => {
        [].forEach.call(document.querySelectorAll('#selectednodes img'), (img) => {
            img.addEventListener('click', nodePreviewImageClicked)
        })

    //}, 1000)

}

function nodePreviewImageClicked(e) {
    const index = parseInt(e.srcElement.getAttribute('__data_index'))
    //showMetaBox(index, true)
}

window.addEventListener('mousedown', (e) => {
    mouseDown = true;
    sx = e.clientX;
    sy = e.clientY;
    ssx = e.clientX;
    ssy = e.clientY;

    mouseStart.x = ( e.clientX / w ) * 2 - 1;
    mouseStart.y = - ( e.clientY / h ) * 2 + 1;


})

window.addEventListener('mouseup', (e) => {
    mouseDown = false;
    if(shiftDown) {
        calculateSelection()
        selectionEl.style.opacity = 0
    }
})


window.addEventListener('mousemove', (e) => {
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
    /*
    mouseEl.innerText = e.clientX + ' ' + e.clientY
    mouseEl.style.top = e.clientY
    mouseEl.style.left = e.clientX
    */
})

window.addEventListener('keydown', (e) => {
   if(e.keyCode===16) {
         document.body.style.cursor = 'crosshair'
        shiftDown = true
   }
})

window.addEventListener('keyup', (e) => {
   if(e.keyCode === 16) {
        shiftDown = false
        document.body.style.cursor = 'default'
   }
})


window.addEventListener( 'mousewheel', mousewheel, false );
window.addEventListener( 'DOMMouseScroll', mousewheel, false ); // firefox

//don't zoom when on images
selectedNodesEl.addEventListener( 'mousewheel', (e) => { e.stopPropagation() }, false );
selectedNodesEl.addEventListener( 'DOMMouseScroll', (e) => { e.stopPropagation() }, false ); // firefox

selectedNodesEl.addEventListener( 'mousemove', (e) => { e.stopPropagation() }, false ); // firefox


function mousewheel(e) {
    console.log(e)
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

function hoverHighlightFast() {
    const HOVER_TOl = 10
    const mouse3D = intersectWithBackPlane(mouse)

    const newHighlightedNodes = []
    for(let i = 0; i < pointGeo.vertices.length; i++) {
    //pointGeo.vertices.forEach((node, i) => {
        const node = pointGeo.vertices[i]
        const distance = UTILS.calculateDistance(mouse3D.x, mouse3D.y, node.x, node.y)
        //console.log(mouse3D, node, distance)
        if(distance < HOVER_TOl) {
            //console.log(i, distance, mouse3D, node)
            newHighlightedNodes.push({index: i, distance: distance, mode: HIGHLIGHT_MODES.HOVER})


        }
        
    //})
    }
    newHighlightedNodes.sort((a, b) => a.distance - b.distance)
    const newHighlightedNode = newHighlightedNodes[0]

    const nodesNoLongerHighlighted = highlightedNodes.filter((node) => {

        return node.mode === HIGHLIGHT_MODES.HOVER && (newHighlightedNode==undefined || newHighlightedNode.index!==node.index)
    })
    resetNodeColors(nodesNoLongerHighlighted)

    highlightedNodes = newHighlightedNodes

    highlightHoveredNodes()
    //console.log(highlightedNodes)

}

function highlightHoveredNodes() {

    const sortedHighlights = highlightedNodes.filter((node) => node.mode === HIGHLIGHT_MODES.HOVER)

    if(sortedHighlights.length===0) {
        points.geometry.colorsNeedUpdate = true
        //TODO move this to showMetaBox?
        console.log(11)
        metaDivEl.style.opacity = 0
        return
    }
    const currentHighlight = sortedHighlights[0]
    const index = currentHighlight.index

    pointGeo.colors[index] = new THREE.Color().setRGB( 0, 0 , 0)

    points.geometry.colorsNeedUpdate = true

    const highlightPosition = pointGeo.vertices[index]
    highlightPosition.z = 0.5
    pointGeo.vertices[index] = highlightPosition
    pointGeo.verticesNeedUpdate = true

    showMetaBox(index)

}

function showMetaBox(index, debug) {

    const nodeMetaData = getMetaDataByIndex(index)
    if(nodeMetaData) {
        imageEl.setAttribute('src', dataSetProperties.imageAccessor(nodeMetaData))
        titleEl.innerText = nodeMetaData ? nodeMetaData.title : ''
        categoryEl.innerText = nodeMetaData ? nodeMetaData.groups.join(', ') : ''
        metaDivEl.style.top =  - (mouse.y - 1)/2 * h + 5
        metaDivEl.style.left = (mouse.x + 1)/2 * w + 5
        metaDivEl.style.opacity = 1
        if(debug) {
            console.log(nodeMetaData)
            console.log(metaDivEl)
        }
        else {
            console.log(index)
        }

    }    

}

/*
function hoverHighlight() {
    raycaster.setFromCamera( mouse, camera );

    // calculate objects intersecting the picking ray
    var intersects = []
    intersects = raycaster.intersectObjects(scene.children, true);


    // just higlight one point!!!
    for ( var i = 0; i < Math.min(intersects.length, 1); i++ ) {

        

        const intersect = intersects[0]
        //console.log(intersect.object.type)
        const index = intersect.index


    
        //to change back the color
        const nodesNoLongerHighlighted = highlightedNodes.filter((node) => node.index!==index && node.mode===HIGHLIGHT_MODES.HOVER)
        resetNodeColors(nodesNoLongerHighlighted)

        //remove previously hovered nodes
        highlightedNodes = highlightedNodes.filter((node) => node.mode!=HIGHLIGHT_MODES.HOVER)

        highlightedNodes.push({index: index, mode: HIGHLIGHT_MODES.HOVER})



        pointGeo.colors[index] = new THREE.Color().setRGB( 0, 0 , 0)
        points.geometry.colorsNeedUpdate = true

        const highlightPosition = pointGeo.vertices[index]
        highlightPosition.z = 0.5
        pointGeo.vertices[index] = highlightPosition
        pointGeo.verticesNeedUpdate = true


        const nodeMetaData = getMetaDataByIndex(index)
        if(nodeMetaData && !shiftDown) {
            imageEl.setAttribute('src', dataSetProperties.imageAccessor(nodeMetaData))
            titleEl.innerText = nodeMetaData ? nodeMetaData.title : ''
            categoryEl.innerText = nodeMetaData ? nodeMetaData.groups.join(', ') : ''
            metaDivEl.style.top =  - (mouse.y - 1)/2 * h + 5
            metaDivEl.style.left = (mouse.x + 1)/2 * w + 5
            metaDivEl.style.opacity = 1

        }


    }
    
    if(intersects.length==0) {

        const nodesNoLongerHighlighted = highlightedNodes.filter((node) => node.mode===HIGHLIGHT_MODES.HOVER)
        resetNodeColors(nodesNoLongerHighlighted)


        metaDivEl.style.opacity = 0



    }  
}
*/

function resetNodeColors(nodesNoLongerHighlighted) {

    nodesNoLongerHighlighted.forEach((node) => {

        const nodeMeta = getMetaDataByIndex(node.index)
        const pointColor = colorScale(dataSetProperties.colorAccessor(nodeMeta))
        const pointRGB = UTILS.hexToRgb(pointColor)
        pointGeo.colors[node.index] = new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255)

        const highlightPosition = pointGeo.vertices[node.index]
        highlightPosition.z = 0
        pointGeo.vertices[node.index] = highlightPosition
        pointGeo.verticesNeedUpdate = true


    })

}

function animate() {
    //last = t;
    renderer.clear();
    //console.log(mouse)
    //hoverHighlight() 
    if(!shiftDown && !mouseDown) {
        hoverHighlightFast()

    }
    else {
        metaDivEl.style.opacity = 0
    }

    //camera.lookAt(scene.position);
    renderer.render(scene, camera);

    window.requestAnimationFrame(animate, renderer.domElement);
};

animate()//new Date().getTime());



