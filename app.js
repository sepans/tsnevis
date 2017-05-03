const w = window.innerWidth, h = window.innerHeight, near = -500, far = 1000, margin = 20

let highlightedNodes = {hover: [], selection: []}

const ZOOM_MIN_Z = 100
      ZOOM_MAX_Z = 1000

const logScale = d3.scaleLog()

const HOVER_TOl = 10

const DARKEN_FACTOR = 0.6

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

let line

renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
renderer.setClearColor(0xFFFFFF, 1.0);

const scene = new THREE.Scene();

const scatterPlot = new THREE.Object3D();
scene.add(scatterPlot);

const PARTICLE_SIZE = 4

const mat = new THREE.PointsMaterial({
    vertexColors: true,
    size: PARTICLE_SIZE
});


const pointGeo = new THREE.Geometry();
const points = new THREE.Points(pointGeo, mat);

const showStat = false
      stats = null

if(showStat) { 
    var script=document.createElement('script');
    script.src='//rawgit.com/mrdoob/stats.js/master/build/stats.min.js';
    document.head.appendChild(script);
    script.onload=function() {
        stats = new Stats();
        stats.showPanel(0)
        document.body.appendChild( stats.dom );
    }
}

let allCoords;
let allMetaData;

const COLUMN_TYPES = {DATE: 'DATE', NUMBER: 'NUMBER'}

const dataSetProperties = {
    idAccessor: d => d.id,
    metaDataAccessor: d => d.meta,
    xAccessor: d => d.coords[0],
    yAccessor: d => d.coords[1],
    colorAccessor: m => m ? 'a' : null,
    imageAccessor: m => m ? m.sizes[1].source : null,
    metaColumnTypes: {
        'date': COLUMN_TYPES.DATE,
        'comments': COLUMN_TYPES.NUMBER,
        'views': COLUMN_TYPES.NUMBER,
    }
}

const tree = rbush()

const xScale = d3.scaleLinear()
    .range([margin, w - margin])

const yScale = d3.scaleLinear()
    .range([margin, h - margin])

let colorScale = d3.scaleOrdinal(d3.schemeCategory20c)


let sx = 0,
    sy = 0,
    ssx = 0,
    ssy = 0,
    mouseDown = false,
    shiftDown = false,
    altDown = false,
    overSelectedNodes = false



const metaDivEl = document.getElementById('meta'),
      imageEl = document.querySelector('#meta img'),
      titleEl = document.querySelector('#meta .title'),
      categoryEl = document.querySelector('#meta .category'),
      timeEl = document.querySelector('#meta .time'),
      selectionEl = document.getElementById('selection'),
      selectedNodesEl = document.getElementById('selectednodes'),
      controlsEl = document.getElementById('controls'),
      mouseEl = document.getElementById('mouse')


//TODO metaData no longer needed?!
function addPoints(dataPoints, metaData, idAccessor, xAccessor, yAccessor, colorAccessor) {

	xScale.domain(d3.extent(dataPoints, xAccessor))

	yScale.domain(d3.extent(dataPoints, yAccessor))

	const pointCount = dataPoints.length //37107

	for (let i = 0; i < pointCount; i ++) {
        const id = idAccessor(dataPoints[i])
	    const x = xScale(xAccessor(dataPoints[i]));
	    const y = yScale(yAccessor(dataPoints[i]));
	    const z = 0//Math.random() * 500

        tree.insert({minX: x, minY: y, maxX: x, maxY: y, id: id, index: i })

	    pointGeo.vertices.push(new THREE.Vector3(x, y, z));
	    
	    //pointGeo.vertices[i].angle = Math.atan2(z, x);
	    //pointGeo.vertices[i].radius = Math.sqrt(x * x + z * z);
	    //pointGeo.vertices[i].speed = (z / 100) * (x / 100);
        const pointRGB = getRGBColorByIndex(i)

	    //pointGeo.colors.push(new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255));
        pointGeo.colors.push(new THREE.Color().setRGB(0.9, 0.9, 0.9))

	}
    console.log('rbush search')
    console.log(tree.search({minX: xScale(xAccessor(dataPoints[0])), minY: yScale(yAccessor(dataPoints[0])),
                         maxX: xScale(xAccessor(dataPoints[0])), maxY: yScale(yAccessor(dataPoints[0]))}))

	scatterPlot.add(points);

	renderer.render(scene, camera);

}

//load data

const q = d3.queue()
    //.defer(d3.json, 'data/word2vec_tsne_2d.json')
    .defer(d3.json, 'data/conv2vec_tsne_026.json')
    .defer(d3.json, 'data/word2vec_meta_short.json')
    .defer(d3.json, 'data/user_sequences.json')
    .awaitAll((error, results) => {
        if (error) {
            console.log('ERROR', error)
            throw error;
        }
        const tsne = results[0],
              meta = results[1]
        console.log(meta[0], meta.length)
        console.log(tsne[0], tsne.length)
        console.log(results[2][0])




        allMetaData = UTILS.createMetaDataMap(results[1], 
                        dataSetProperties.idAccessor, dataSetProperties.metaDataAccessor)
        allCoords = tsne//.sort((a, b) => parseInt(a.id) - parseInt(b.id))
        UTILS.createMetaDataMap(meta, 
                        dataSetProperties.idAccessor, dataSetProperties.metaDataAccessor)
        createMetaDataOptions()
        
        addPoints(allCoords, allMetaData, 
            dataSetProperties.idAccessor,
            dataSetProperties.xAccessor, dataSetProperties.yAccessor,
            dataSetProperties.colorAccessor)

        const indexByIdMap = UTILS.createIndexByIdMap(tsne, dataSetProperties.idAccessor)

        console.log(indexByIdMap)
        const start = 68
        d3.range(start, 69).forEach(indx => {

            setTimeout(() => {
                resetNodeColors(highlightedNodes.selection)
                //highlightedNodes.selection = []

                selectedNodesEl.innerText = 'user '+ indx
                console.log(indx)
                highlightedNodes.selection = results[2][indx].map(d => { return {index: indexByIdMap[d]}}).filter(d => d.index >=0 )

                //console.log(highlightedNodes.selection)

                
                highlightedNodes.selection.forEach((result, i) => {
                    //console.log(result.index, i, pointGeo.colors.length, pointGeo.colors[result.index])
                    if(result.index >=0) {
                        const pointColor = pointGeo.colors[result.index]
                        pointColor.setRGB(1, 0 ,0 )
                        const pointPosition = pointGeo.vertices[result.index]
                        pointPosition.z = 1//200
                    }
                    
                })
                
                //var MAX_POINTS = 500;

                var points = highlightedNodes.selection.map(d => {
                    const ind = d.index
                    const x = xScale(dataSetProperties.xAccessor(allCoords[ind]));
                    const y = yScale(dataSetProperties.yAccessor(allCoords[ind]));
                    const z = 0//Math.random() * 500

                    return new THREE.Vector3(x, y, z)
                    
                })

                // geometry
                var geometry = new THREE.BufferGeometry();

                // attributes
                numPoints = points.length;
                var positions = new Float32Array( numPoints * 3 ); // 3 vertices per point
                var colors = new Float32Array( numPoints * 3 ); // 3 channels per point
                var lineDistances = new Float32Array( numPoints * 1 ); // 1 value per point

                geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
                geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
                geometry.addAttribute( 'lineDistance', new THREE.BufferAttribute( lineDistances, 1 ) );

                // populate
                var color = new THREE.Color();

                for ( var i = 0, index = 0, l = numPoints; i < l; i ++, index += 3 ) {

                    positions[ index ] = points[ i ].x;
                    positions[ index + 1 ] = points[ i ].y;
                    positions[ index + 2 ] = points[ i ].z;

                    color.setHSL( i / l, 1.0, 0.5 );

                    colors[ index ] = color.r;
                    colors[ index + 1 ] = color.g;
                    colors[ index + 2 ] = color.b;

                    if ( i > 0 ) {

                        lineDistances[ i ] = lineDistances[ i - 1 ] + points[ i - 1 ].distanceTo( points[ i ] );

                    }

                }

                lineLength = lineDistances[ numPoints - 1 ];


                // material
                var material = new THREE.LineDashedMaterial( {

                    vertexColors: THREE.VertexColors,
                    dashSize: 1, // to be updated in the render loop
                    gapSize: 1e10 // a big number, so only one dash is rendered

                } );

                // line
                line = new THREE.Line( geometry, material );
                scene.add( line );                


            }, (indx - start) * 700)


        })


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

    const columnKey = keys[index]
    dataSetProperties.colorAccessor = d => d ? d[columnKey] : null

    const columnType = dataSetProperties.metaColumnTypes[columnKey]
    switch(columnType) {
        case COLUMN_TYPES.DATE:
            dataSetProperties.colorAccessor = d =>  d ? new Date(d[columnKey] * 1000) : null
            //console.log(dataSetProperties.colorAccessor(allMetaData[0]))
            //console.log('min', d3.min(Object.values(allMetaData), dataSetProperties.colorAccessor))
            colorScale = d3.scaleSequential(d3.interpolateCool)
                    .domain(d3.extent(Object.values(allMetaData), dataSetProperties.colorAccessor))
            break;
        case COLUMN_TYPES.NUMBER:
            dataSetProperties.colorAccessor = d =>  d ? d[columnKey] : null
            //console.log(dataSetProperties.colorAccessor(allMetaData[0]))
            //console.log('min', d3.min(Object.values(allMetaData), dataSetProperties.colorAccessor))
            const domain = d3.extent(Object.values(allMetaData), dataSetProperties.colorAccessor)
            if(domain[0]===0) {
                domain[0] = Math.min(0.001, domain[1]/1000)
            }
            logScale.domain(domain)
            colorScale = d3.scaleSequential((d) => d3.interpolateCool(logScale(d)))
                   // .domain()
            break;
        default: 
            colorScale = d3.scaleOrdinal(d3.schemeCategory20c)
    }
    changeColors(true)
}

function getRGBColorByIndex(index) {

    const colorAccessor = dataSetProperties.colorAccessor
    const metaData = allMetaData
    const nodeMetaData = getMetaDataByIndex(index)

    const metaDataValue = colorAccessor(nodeMetaData)
    const pointColor = metaDataValue ? colorScale(metaDataValue) : '#AAAAAA'

    if(!pointColor ) {
        console.log(colorScale.domain()[1])
        
    }
    return UTILS.convertToRGB(pointColor)

}

function changeColors(setNeedUpdate) {

    pointGeo.colors.forEach((color, i) => {
        //console.log(i, nodeMetaData,colorAccessor(nodeMetaData), colorScale(colorAccessor(nodeMetaData)) )
        
        const pointRGB = getRGBColorByIndex(i)

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

    const nodesNoLongerHighlighted = highlightedNodes.selection
    highlightedNodes.selection = []
    console.log(nodesNoLongerHighlighted)
    resetNodeColors(nodesNoLongerHighlighted)

    const searchBox = {
                minX: Math.min(topLeft.x, bottomRight.x),
                minY: Math.min(topLeft.y, bottomRight.y),
                maxX: Math.max(topLeft.x, bottomRight.x),
                maxY: Math.max(topLeft.y, bottomRight.y)
            }

    const searchResults = tree.search(searchBox)


    searchResults.forEach(result => {
            const pointColor = pointGeo.colors[result.index]
            pointColor.setRGB(pointColor.r * DARKEN_FACTOR , pointColor.g * DARKEN_FACTOR , pointColor.b * DARKEN_FACTOR )
            const pointPosition = pointGeo.vertices[result.index]
            pointPosition.z = 1
            highlightedNodes.selection.push({index: result.index})

    })
    pointGeo.verticesNeedUpdate = true
    points.geometry.colorsNeedUpdate = true

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
    highlightedNodes.selection.forEach((node) => {
        if(allMetaData) {
            const nodeMetaData = getMetaDataByIndex(node.index)
            selectedNodesHTML = `${selectedNodesHTML} <img __data_id="${getIdByIndex(node.index)}" __data_index="${node.index}" src="${dataSetProperties.imageAccessor(nodeMetaData)}">` 
        }

    })
    selectedNodesEl.innerHTML = selectedNodesHTML;

    [].forEach.call(document.querySelectorAll('#selectednodes img'), (img) => {
        img.addEventListener('click', nodePreviewImageClicked)
    })


}

function nodePreviewImageClicked(e) {
    const index = parseInt(e.srcElement.getAttribute('__data_index'))
    showMetaBox(index, true)
}

function hoverHighlightFast() {
    if(overSelectedNodes) {
        return
    }
    const mouse3D = intersectWithBackPlane(mouse)

    const newHighlightedNodes = []

    const searchBox = {
            minX: mouse3D.x - HOVER_TOl,
            minY: mouse3D.y - HOVER_TOl,
            maxX: mouse3D.x + HOVER_TOl,
            maxY: mouse3D.y + HOVER_TOl
        }

    const searchResults = tree.search(searchBox)

    searchResults.forEach(result => {

        const node = pointGeo.vertices[result.index]
        const distance = UTILS.calculateDistance(mouse3D.x, mouse3D.y, result.minX, result.minY)
        newHighlightedNodes.push({index: result.index, distance: distance})

    })

    newHighlightedNodes.sort((a, b) => a.distance - b.distance)
    const newHighlightedNode = newHighlightedNodes[0]

    const nodesNoLongerHighlighted = highlightedNodes.hover.filter((node) => {
        return (newHighlightedNode==undefined || newHighlightedNode.index!==node.index) 
    })
    resetNodeColors(nodesNoLongerHighlighted)

    highlightedNodes.hover = newHighlightedNodes

    highlightHoveredNodes()
    //console.log(highlightedNodes)

}

function highlightHoveredNodes() {

    const sortedHighlights = highlightedNodes.hover

    if(sortedHighlights.length===0) {
        points.geometry.colorsNeedUpdate = true
        //TODO move this to showMetaBox?
        metaDivEl.style.opacity = 0
        return
    }
    const currentHighlight = sortedHighlights[0]
    const index = currentHighlight.index

    pointGeo.colors[index] = new THREE.Color().setRGB( 0, 0 , 0)

    points.geometry.colorsNeedUpdate = true

    const highlightPosition = pointGeo.vertices[index]
    highlightPosition.z = 1
    pointGeo.vertices[index] = highlightPosition
    pointGeo.verticesNeedUpdate = true

    showMetaBox(index, false)

}

function showMetaBox(index, pointPosition) {

    const nodeMetaData = getMetaDataByIndex(index)
    if(nodeMetaData) {
        imageEl.setAttribute('src', dataSetProperties.imageAccessor(nodeMetaData))
        titleEl.innerText = nodeMetaData ? nodeMetaData.title : ''
        categoryEl.innerText = nodeMetaData ? nodeMetaData.groups.join(', ') +' ' +  nodeMetaData.comments +' '+ nodeMetaData.views : ''
        timeEl.innerText = nodeMetaData ? new Date(nodeMetaData.date * 1000).toString().substring(0, 25) : ''
        //if pointPosition calculate point position otherwise use mouse location
        let x, y
        if(pointPosition) {
            const xScreen =   xScale(dataSetProperties.xAccessor(allCoords[index]))
            const yScreen =   yScale(dataSetProperties.yAccessor(allCoords[index]))

            const dPos = new THREE.Vector3(xScreen, yScreen, 0)
            const project = dPos.project(camera)

            x = ( project.x * w/2 ) + w/2;
            y = - ( project.y * h/2 ) + h/2;

        }
        else {
            x =  (mouse.x + 1)/2 * w + 5 
            y = - (mouse.y - 1)/2 * h + 5 

        }
        metaDivEl.style.top = y
        metaDivEl.style.left = x

        metaDivEl.style.opacity = 1

    }
    else {
        imageEl.setAttribute('src', '')
        titleEl.innerText = ''
        categoryEl.innerText =  ''
        timeEl.innerText =  ''

    }    

}


function resetNodeColors(nodesNoLongerHighlighted) {
    //console.log('reseting ', nodesNoLongerHighlighted)

    nodesNoLongerHighlighted.forEach((node) => {

        
        const pointRGB = getRGBColorByIndex(node.index)
        const makeDarker = highlightedNodes.selection.filter(d => d.index===node.index).length ? DARKEN_FACTOR : 1
        // pointGeo.colors[node.index] = new THREE.Color().setRGB(pointRGB.r/255 * makeDarker,
        //                                                        pointRGB.g/255 * makeDarker,
        //                                                        pointRGB.b/255 * makeDarker)

        pointGeo.colors[node.index] = new THREE.Color().setRGB(0.9, 0.9, 0.9)

        const highlightPosition = pointGeo.vertices[node.index]
        highlightPosition.z = 0
        pointGeo.vertices[node.index] = highlightPosition


    })
    pointGeo.verticesNeedUpdate = true

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
        if(shiftDown) {
            selectionEl.style.opacity = 1
            selectionEl.style.top = Math.min(ssy, sy)
            selectionEl.style.left = Math.min(ssx, sx)
            selectionEl.style.width = Math.abs(ssx - sx)+'px'
            selectionEl.style.height = Math.abs(ssy - sy)+'px'
        }
        else if (altDown) {
            scatterPlot.rotation.y += dx * 0.01;
            //scatterPlot.rotation.x += dy * 0.01;
            camera.position.y += dy * 1.5;
            //console.log( dy, camera.position.y)
        }   
        else {
            camera.position.x -= dx;
            camera.position.y += dy;

        }     
        sx += dx;
        sy += dy;

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
   else if(e.altKey) {
    altDown = true
   }
})

window.addEventListener('keyup', (e) => {
   if(e.keyCode === 16) {
        shiftDown = false
        document.body.style.cursor = 'move'
   }
   else if(e.altKey) {
        altDown = false
   }

})


window.addEventListener( 'mousewheel', mousewheel, false );
window.addEventListener( 'DOMMouseScroll', mousewheel, false ); // firefox

//don't zoom when on images
selectedNodesEl.addEventListener( 'mousewheel', (e) => { e.stopPropagation() }, false );
selectedNodesEl.addEventListener( 'DOMMouseScroll', (e) => { e.stopPropagation() }, false ); // firefox

selectedNodesEl.addEventListener( 'mousemove', (e) => { e.stopPropagation() }, false ); // firefox
selectedNodesEl.addEventListener( 'mouseover', (e) => { overSelectedNodes = true }, false ); // firefox
selectedNodesEl.addEventListener( 'mouseout', (e) => { overSelectedNodes = false }, false ); // firefox


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

let fraction = 0
function animate() {
    
    if(stats) {
        stats.begin();
    }
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


    if(line) {
    fraction = ( fraction + 0.0005 ); // fraction in [ 0, 1 ]
    line.material.dashSize = fraction * lineLength;

    }

    if(stats) {
        stats.end();
    }


    window.requestAnimationFrame(animate, renderer.domElement);

}

animate()//new Date().getTime());



