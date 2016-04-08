'use strict';

var canvas = null;
var context = null;

var viewportWidth;
var viewportHeight;

var fov  = 60;
var near = 0.1;
var far  = 100;
var s    = 1 / Math.tan(fov * 0.5 * Math.PI / 180);

var imageData, blankImageData;
var depthBuffer;

var perspectiveMatrix = [
    [s, 0, 0, 0],
    [0, s, 0, 0],
    [0, 0, -far / (far - near), -far * near / (far - near)],
    [0, 0, -1, 0]
];

// This cube consists of 12 triangles, with 2 triangles forming each of the 6 faces.
var cubeTriangles = [

    // top face
    [[-1,  1,  1], [ 1,  1,  1], [ 1,  1, -1]],
    [[ 1,  1, -1], [-1,  1, -1], [-1,  1,  1]],

    // bottom face
    [[-1, -1,  1], [ 1, -1,  1], [ 1, -1, -1]],
    [[ 1, -1, -1], [-1, -1, -1], [-1, -1,  1]],

    // front face
    [[-1, -1,  1], [-1,  1,  1], [ 1,  1,  1]],
    [[ 1,  1,  1], [ 1, -1,  1], [-1, -1,  1]],

    // back face
    [[-1, -1, -1], [-1,  1, -1], [ 1,  1, -1]],
    [[ 1,  1, -1], [ 1, -1, -1], [-1, -1, -1]],

    // left face
    [[-1,  1, -1], [-1,  1,  1], [-1, -1,  1]],
    [[-1, -1,  1], [-1, -1, -1], [-1,  1, -1]],

    // right face
    [[ 1,  1, -1], [ 1,  1,  1], [ 1, -1,  1]],
    [[ 1, -1,  1], [ 1, -1, -1], [ 1,  1, -1]],
];

var cubeColors = [
    [255,   0,   0], [255,   0,   0], // bottom face color
    [  0, 255,   0], [  0, 255,   0], // top face color
    [  0,   0, 255], [  0,   0, 255], // front face color
    [255, 255,   0], [255, 255,   0], // back face color
    [  0, 255, 255], [  0, 255, 255], // left face color
    [255,   0, 255], [255,   0, 255]  // right face color
];

var tetrahedronTriangles = [
    [[ 1,  0, -0.71], [-1,  0, -0.71], [ 0,  1,  0.71]],
    [[ 0,  1,  0.71], [ 0, -1,  0.71], [ 1,  0, -0.71]],
    [[ 0, -1,  0.71], [-1,  0, -0.71], [ 0,  1,  0.71]],
    [[ 0, -1,  0.71], [-1,  0, -0.71], [ 1,  0, -0.71]]
];

var tetrahedronColors = [
    [255, 255,   0],
    [255,   0,   0],
    [  0, 255,   0],
    [  0,   0, 255]
]

function setWorkingCanvas(name)
{
    canvas = document.getElementById(name);
    context = canvas.getContext('2d');

    viewportWidth = canvas.width;
    viewportHeight = canvas.height;

    createDepthBuffer(viewportWidth, viewportHeight);
    blankImageData = context.createImageData(viewportWidth, viewportHeight);
    imageData = imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    for(var i = 0; i < viewportWidth * viewportHeight * 4; i += 4)
    {
        blankImageData.data[i] = 0;
        blankImageData.data[i + 1] = 0;
        blankImageData.data[i + 2] = 0;
        blankImageData.data[i + 3] = 255;
    }
}

function edgeFunction(a, b, c) 
{
    return (c[0] - a[0])*(b[1] - a[1]) - (c[1] - a[1])*(b[0] - a[0]);
} 

function drawTriangle(imageData, a, b, c, color)
{
    // To calculate barycentric coordinates, we need to be able to access the points of the triangle
    // in a counter-clockwise order, so we store the CCW order of the vertices into v0, v1, and v2.

    // Given the matrix:
    // | ax ay 1 |
    // | bx by 1 |
    // | cx cy 1 |
    // If the determinant is less than zero, then the points are in CCW order (if the origin is at the topleft).
    // Otherwise, the points are in CW order, and we must swap any two points. Found this trick here:
    // http://gamedev.stackexchange.com/questions/13229/sorting-array-of-points-in-clockwise-order
    var v0 = a;
    var v1 = b;
    var v2 = c;
    var det = a[0]*b[1] + b[0]*c[1] + c[0]*a[1] - b[1]*c[0] - c[1]*a[0] - a[1]*b[0];
    if(det >= 0)
    {
        v1 = c;
        v2 = b;
    }

    var areaABC = edgeFunction(v0, v1, v2);

    // Calculate the edges of the triangle's bounding box
    var top = Math.min(a[1], b[1], c[1]);
    var bottom = Math.max(a[1], b[1], c[1]);
    var left = Math.min(a[0], b[0], c[0]);
    var right = Math.max(a[0], b[0], c[0]);

    // Now we iterate through each pixel within the bounding box of the triangle
    for(var y = Math.floor(top); y <= Math.floor(bottom); y++)
    {
        for(var x = Math.floor(left); x <= Math.floor(right); x++)
        {
            // Calculate the barycentric coordinates of the point with respect to the triangle
            var p = [x + 0.5, y + 0.5, 0];
            var w0 = edgeFunction(v1, v2, p) / areaABC;
            var w1 = edgeFunction(v2, v0, p) / areaABC;
            var w2 = edgeFunction(v0, v1, p) / areaABC;

            // Note that any point v within the triangle v0, v1, and v2 can be described as
            // v = w0*v0 + w1*v1 + w2*v2
            // What is of particular use here is that if a 

            // if the point lines on the triangle, we'll (probably) draw it...
            if(w0 >= 0 && w1 >= 0 && w2 >= 0)
            {
                // ...however, we don't want to draw things that are very far away "in front of" nearby objects. To do this,
                // we use a Z-buffer to store the Z-value of each pixel, and only draw over an existing pixel if the
                // program finds a closer pixel.
                var z = -1 / (v0[2]*w0 + v1[2]*w1 + v2[2]*w2);
                if(z < depthBuffer[y][x])
                {
                    var i = (imageData.width * y + x) * 4;
                    imageData.data[i + 0] = color[0];
                    imageData.data[i + 1] = color[1];
                    imageData.data[i + 2] = color[2];
                    depthBuffer[y][x] = z;
                }
            }
        }
    }
}

function getIdentityMatrix()
{
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}

function rotate(transform, angle, x, y, z)
{
    // normalize (x, y, z) if necessary
    var distSquared = x*x + y*y + z*z;
    if(distSquared != 1 && distSquared != 0)
    {
        var dist = Math.sqrt(distSquared);
        x /= dist;
        y /= dist;
        z /= dist;
    }

    // A very fancy rotation transformation matrix. This is the same matrix
    // that OpenGL uses for its glRotatef function.
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    var T = [
        [x*x*(1-c)+c, x*y*(1-c)-z*s, x*y*(1-c)+y*s, 0],
        [y*x*(1-c)+z*s, y*y*(1-c)+c, y*z*(1-c)-x*s, 0],
        [x*z*(1-c)-y*s, y*z*(1-c)+x*s, z*z*(1-c)+c, 0],
        [            0,             0,           0, 1]
    ];
    return matrixMultiply(transform, T);
}

function translate(transform, x, y, z)
{
    var T = [
        [1, 0, 0, x],
        [0, 1, 0, y],
        [0, 0, 1, z],
        [0, 0, 0, 1]
    ];
    return matrixMultiply(transform, T);
}

function scale(transform, x, y, z)
{
    var T = [
        [x, 0, 0, 0],
        [0, y, 0, 0],
        [0, 0, z, 0],
        [0, 0, 0, 1]
    ];
    return matrixMultiply(transform, T);
}

// This function converts normalized coordinates (-1.0 to 1.0) to our screenspace, which is in pixels.
function convertToPixelCoordinates(normalizedPoint)
{
    return [
        Math.min(viewportWidth  - 1, ((normalizedPoint[0] + 1) * 0.5 * viewportWidth)),
        Math.min(viewportHeight - 1, ((1 - (normalizedPoint[1] + 1) * 0.5) * viewportHeight)),
        normalizedPoint[2]
    ];
}

// This function will draw an array of triangles with 3D coordinates onto the screen in pixels.
function drawAllTriangles3D(triangles, colors, transform, imageData)
{
    for(var i = 0; i < triangles.length; i++)
    {
        // All of the triangle's vertices are in R^3. We need them to be in R^4 to perform
        // multiplications with a 4x4 matrix, so we add a 'w' coordinate to the 3D vectors
        // with a value of 1.
        var a = triangles[i][0].concat([1]);
        var b = triangles[i][1].concat([1]);
        var c = triangles[i][2].concat([1]);

        // Now we apply the transformation to each of the triangle's 3 vertices.
        a = matrixMultiplyVector(transform, a);
        b = matrixMultiplyVector(transform, b);
        c = matrixMultiplyVector(transform, c);

        // Now we perform the perspective transformation.
        var projA = transformCoordinate(perspectiveMatrix, a);
        var projB = transformCoordinate(perspectiveMatrix, b);
        var projC = transformCoordinate(perspectiveMatrix, c);

        // We don't want to draw triangles that are outside the screen's boundaries
        if((projA[0] < -1 || projA[0] > 1 || projA[1] < -1 || projA[1] > 1) &&
           (projB[0] < -1 || projB[0] > 1 || projB[1] < -1 || projB[1] > 1) &&
           (projC[0] < -1 || projC[0] > 1 || projC[1] < -1 || projC[1] > 1))
            continue;

        // Convert the normalized coordinates (between -1.0 to 1.0) to pixel-space
        var screenA = convertToPixelCoordinates(projA);
        var screenB = convertToPixelCoordinates(projB);
        var screenC = convertToPixelCoordinates(projC);

        // Finally, draw a triangle using the projected coordinates. The drawTriangle
        // function will handle depth-buffering.
        drawTriangle(imageData, screenA, screenB, screenC, colors[i]);
    }
}

function createDepthBuffer(width, height)
{
    depthBuffer = [];
    for(var y = 0; y < height; y++)
    {
        depthBuffer[y] = [];
        for(var x = 0; x < width; x++)
        {
            depthBuffer[y][x] = Infinity;
        }
    }
}

function clearDepthBuffer()
{
    for(var y = 0; y < depthBuffer.length; y++)
        for(var x = 0; x < depthBuffer[0].length; x++)
            depthBuffer[y][x] = Infinity;
}

function init()
{
    toggleAnimation();
}

var angle = 0;

function draw()
{
    angle += 0.01;

    context.fillStyle = "black";
    context.fillRect(0, 0, canvas.width, canvas.height);

    clearDepthBuffer();
    imageData.data.set(blankImageData.data);

    var T = getIdentityMatrix();
    T = translate(T, 0, 0, -5);
    T = rotate(T, angle, 1, 0, 0);
    T = rotate(T, angle, 0, 1, 0);
    drawAllTriangles3D(tetrahedronTriangles, tetrahedronColors, T, imageData);
    T = scale(T, -1, -1, -1);
    drawAllTriangles3D(tetrahedronTriangles, tetrahedronColors, T, imageData);

    T = getIdentityMatrix();
    T = translate(T, 10, -10, -30);
    T = rotate(T, angle * 4, 0, 0, 1);
    T = rotate(T, angle * 4, 0, 1, 0);
    drawAllTriangles3D(cubeTriangles, cubeColors, T, imageData);

    context.putImageData(imageData, 0, 0);
}

var intervalId = null;
function toggleAnimation()
{
    if(intervalId != null)
    {
        window.clearInterval(intervalId);
        intervalId = null;
    }
    else
        intervalId = window.setInterval(draw, 16);
}
