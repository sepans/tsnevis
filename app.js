const w = window.innerWidth, h = window.innerHeight 


const ZOOM_MIN_Z = 100
      ZOOM_MAX_Z = 1000
      MARGIN = 20
      HOVER_TOl = 10
      DARKEN_FACTOR = 0.6
      PARTICLE_SIZE = 4

const COLUMN_TYPES = {DATE: 'DATE', NUMBER: 'NUMBER'}

const threejsObjects = {
    camera: new THREE.PerspectiveCamera(45, w / h, 1, 10000),
    raycaster: new THREE.Raycaster(),
    renderer: new THREE.WebGLRenderer({antialias: true}),
    groupLine: null,
    scene: new THREE.Scene(),
    scatterPlot: new THREE.Object3D(),
    mat: null,
    pointGeo: new THREE.Geometry(),
    points: null,
    backgroundPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    stats: null

}

const mouse = new THREE.Vector2()
      mouseStart = new THREE.Vector2()

let highlightedNodes = {hover: [], selection: []}
const showStat = false

let allCoords,
    allMetaData,
    groupsData,
    indexByIdMap

let sx = 0,
    sy = 0,
    ssx = 0,
    ssy = 0,
    mouseDown = false,
    shiftDown = false,
    altDown = false,
    overSelectedNodes = false



const dataSetProperties = {
    idAccessor: d => d.id,
    metaDataAccessor: d => d.meta,
    xAccessor: d => d.coords[0],
    yAccessor: d => d.coords[1],
    colorAccessor: m => m ? m.groups[0] : null,
    imageAccessor: m => m ? m.sizes[1].source : null,
    metaColumnTypes: {
        'date': COLUMN_TYPES.DATE,
        'comments': COLUMN_TYPES.NUMBER,
        'views': COLUMN_TYPES.NUMBER,
    }
}


const tree = rbush()

const xScale = d3.scaleLinear()
    .range([MARGIN, w - MARGIN])

const yScale = d3.scaleLinear()
    .range([MARGIN, h - MARGIN])

let colorScale = d3.scaleOrdinal(d3.schemeCategory20c)

const logScale = d3.scaleLog()


const metaDivEl = document.getElementById('meta'),
      imageEl = document.querySelector('#meta img'),
      titleEl = document.querySelector('#meta .title'),
      categoryEl = document.querySelector('#meta .category'),
      timeEl = document.querySelector('#meta .time'),
      selectionEl = document.getElementById('selection'),
      selectedNodesEl = document.getElementById('selectednodes'),
      controlsEl = document.getElementById('controls'),
      mouseEl = document.getElementById('mouse'),
      groupnumEl = document.getElementById('groupnum')


setupThreeJS()


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

        allMetaData = UTILS.createMetaDataMap(results[1], 
                        dataSetProperties.idAccessor, dataSetProperties.metaDataAccessor)
        allCoords = tsne//.sort((a, b) => parseInt(a.id) - parseInt(b.id))
        groupsData = results[2]
        //needed?
        UTILS.createMetaDataMap(meta, 
                        dataSetProperties.idAccessor, dataSetProperties.metaDataAccessor)
        createMetaDataOptions()
        
        addPoints(allCoords, allMetaData, 
            dataSetProperties.idAccessor,
            dataSetProperties.xAccessor, dataSetProperties.yAccessor,
            dataSetProperties.colorAccessor)

        indexByIdMap = UTILS.createIndexByIdMap(tsne, dataSetProperties.idAccessor)


    })


function setupThreeJS() {


    threejsObjects.camera.position.x = w/2
    threejsObjects.camera.position.y = h/2
    threejsObjects.camera.position.z = 900

    threejsObjects.renderer.setSize(w, h);
    document.body.appendChild(threejsObjects.renderer.domElement);
    threejsObjects.renderer.setClearColor(0xFFFFFF, 1.0);

    threejsObjects.scene.add(threejsObjects.scatterPlot);
    const sprite = new THREE.TextureLoader().load( "circle.png" )
    threejsObjects.mat = new THREE.PointsMaterial( { size: PARTICLE_SIZE, /*map: sprite,*/  vertexColors: THREE. VertexColors, depthTest: false,/*sizeAttenuation: false,*/ opacity: 0.8,  transparent: true } )
//new THREE.PointsMaterial({vertexColors: true, size: PARTICLE_SIZE}),

    threejsObjects.points = new THREE.Points(threejsObjects.pointGeo, threejsObjects.mat)

    if(showStat) { 
        var script=document.createElement('script');
        script.src='//rawgit.com/mrdoob/stats.js/master/build/stats.min.js';
        document.head.appendChild(script);
        script.onload=function() {
            threejsObjects.stats = new Stats();
            threejsObjects.stats.showPanel(0)
            document.body.appendChild( threejsObjects.stats.dom );
        }
    }

}

//TODO metaData no longer needed?!
function addPoints(dataPoints, metaData, idAccessor, xAccessor, yAccessor, colorAccessor) {

    const renderer = threejsObjects.renderer,
          pointGeo = threejsObjects.pointGeo,
          points = threejsObjects.points,
          scatterPlot = threejsObjects.scatterPlot,
          scene = threejsObjects.scene,
          camera = threejsObjects.camera

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

	    pointGeo.colors.push(new THREE.Color().setRGB(pointRGB.r/255, pointRGB.g/255, pointRGB.b/255));
        //pointGeo.colors.push(new THREE.Color().setRGB(0.9, 0.9, 0.9))

	}
    console.log('rbush search')
    console.log(tree.search({minX: xScale(xAccessor(dataPoints[0])), minY: yScale(yAccessor(dataPoints[0])),
                         maxX: xScale(xAccessor(dataPoints[0])), maxY: yScale(yAccessor(dataPoints[0]))}))

	scatterPlot.add(points);

	renderer.render(scene, camera);

}




function addGroupLine(indx) {

    const pointGeo = threejsObjects.pointGeo
          scene = threejsObjects.scene
          //groupLine = threejsObjects.groupLine

    resetNodeColors(highlightedNodes.selection)

    scene.remove(threejsObjects.groupLine)

    //selectedNodesEl.innerText = 'user '+ indx

    highlightedNodes.selection = groupsData[indx].map(d => { return {index: indexByIdMap[d]}}).filter(d => d.index >=0 )

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
    

    var linePoints = highlightedNodes.selection.map(d => {
        const ind = d.index
        const x = xScale(dataSetProperties.xAccessor(allCoords[ind]));
        const y = yScale(dataSetProperties.yAccessor(allCoords[ind]));
        const z = 0//Math.random() * 500

        return new THREE.Vector3(x, y, z)
        
    })

    // geometry
    const geometry = new THREE.BufferGeometry();

    // attributes
    numPoints = linePoints.length;
    const positions = new Float32Array( numPoints * 3 ); // 3 vertices per point
    const colors = new Float32Array( numPoints * 3 ); // 3 channels per point
    const lineDistances = new Float32Array( numPoints * 1 ); // 1 value per point

    geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
    geometry.addAttribute( 'lineDistance', new THREE.BufferAttribute( lineDistances, 1 ) );

    // populate
    const color = new THREE.Color();

    for ( let i = 0, index = 0, l = numPoints; i < l; i ++, index += 3 ) {

        positions[ index ] = linePoints[ i ].x;
        positions[ index + 1 ] = linePoints[ i ].y;
        positions[ index + 2 ] = linePoints[ i ].z;

        color.setHSL( i / l, 1.0, 0.5 );

        colors[ index ] = color.r;
        colors[ index + 1 ] = color.g;
        colors[ index + 2 ] = color.b;

        if ( i > 0 ) {

            lineDistances[ i ] = lineDistances[ i - 1 ] + linePoints[ i - 1 ].distanceTo( linePoints[ i ] );

        }

    }

    lineLength = lineDistances[ numPoints - 1 ];


    // material
    const material = new THREE.LineDashedMaterial( {

        vertexColors: THREE.VertexColors,
        dashSize: 1, // to be updated in the render loop
        gapSize: 1e10 // a big number, so only one dash is rendered

    } );

    // line
    threejsObjects.groupLine = new THREE.Line( geometry, material );
    fraction = 0
    scene.add( threejsObjects.groupLine ); 
}


function createMetaDataOptions() {
    const keys = Object.keys(getMetaDataByIndex(0))
    const options = keys.map(key => `<option>${key}</option>`)
    if(groupsData.length) {
        options.push('<option>highlight groups</option>')
    }
    controlsEl.innerHTML = options
    controlsEl.selectedIndex = 1
    controlsEl.addEventListener('change', (e) => {
      const index = e.srcElement.selectedIndex
      colorOptionChanged(index, keys)  
    }) 
}

function colorOptionChanged(index, keys) {

    const columnKey = keys[index]
    if(columnKey==undefined) {
        dataSetProperties.colorAccessor = d => 'a'
        colorScale = d3.scaleOrdinal().domain(['a']).range(['rgb(200,200,200)'])
        changeColors(false)
        addGroupLine(groupnumEl.value)
        return
    }

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

    const pointGeo = threejsObjects.pointGeo
          points = threejsObjects.points

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

    const pointGeo = threejsObjects.pointGeo
          points = threejsObjects.points

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

 
// finds the intersection between ray and background flat plane
function intersectWithBackPlane(vector2) {

    const camera = threejsObjects.camera,
          raycaster = threejsObjects.raycaster
          backgroundPlane = threejsObjects.backgroundPlane
    
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

    const pointGeo = threejsObjects.pointGeo

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

    const pointGeo = threejsObjects.pointGeo,
          points = threejsObjects.points

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

    const points = threejsObjects.points
          camera = threejsObjects.camera

    const nodeMetaData = getMetaDataByIndex(index)
    if(nodeMetaData) {
        imageEl.setAttribute('src', dataSetProperties.imageAccessor(nodeMetaData))
        titleEl.innerText = nodeMetaData ? nodeMetaData.title : ''
        categoryEl.innerText = nodeMetaData ? nodeMetaData.groups.join(', ') +' c ' +  nodeMetaData.comments +' v '+ nodeMetaData.views : '' //JSON.stringify(nodeMetaData, '\t') : ''
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
    const pointGeo = threejsObjects.pointGeo
    
    nodesNoLongerHighlighted.forEach((node) => {

        
        const pointRGB = getRGBColorByIndex(node.index)
        const makeDarker = highlightedNodes.selection.filter(d => d.index===node.index).length ? DARKEN_FACTOR : 1
        pointGeo.colors[node.index] = new THREE.Color().setRGB(pointRGB.r/255 * makeDarker,
                                                               pointRGB.g/255 * makeDarker,
                                                               pointRGB.b/255 * makeDarker)

        //pointGeo.colors[node.index] = new THREE.Color().setRGB(0.9, 0.9, 0.9)

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
    const camera = threejsObjects.camera
          scatterPlot = threejsObjects.scatterPlot

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
    const cPos = threejsObjects.camera.position;
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

    const renderer = threejsObjects.renderer,
          scene = threejsObjects.scene,
          groupLine = threejsObjects.groupLine,
          camera = threejsObjects.camera,
          stats = threejsObjects.stats
    
    if(stats) {
        stats.begin();
    }

    renderer.clear();

    if(!shiftDown && !mouseDown) {
        hoverHighlightFast()

    }
    else {
        metaDivEl.style.opacity = 0
    }

    renderer.render(scene, camera);

    if(groupLine) {
        fraction = ( fraction + 0.01 ); // fraction in [ 0, 1 ]
        groupLine.material.dashSize = fraction * lineLength;

    }

    if(stats) {
        stats.end();
    }


    window.requestAnimationFrame(animate, renderer.domElement);

}

animate()//new Date().getTime());



