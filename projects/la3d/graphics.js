'use strict';

var canvas = null;
var context = null;

var viewportWidth;
var viewportHeight;

var fov  = 60;
var near = 0.1;
var far  = 1000;
var s    = 1 / Math.tan(fov * 0.5 * Math.PI / 180);

var imageData;
var depthBuffer;

var perspectiveMatrix = [
    [s, 0, 0, 0],
    [0, s, 0, 0],
    [0, 0, -far / (far - near), -1],
    [0, 0, -far * near / (far - near), 0]
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

    context.lineWidth = 2;

    viewportWidth = canvas.width;
    viewportHeight = canvas.height;

    createDepthBuffer(viewportWidth, viewportHeight);
}

function edgeFunction(a, b, c) 
{
    return (c[0] - a[0])*(b[1] - a[1]) - (c[1] - a[1])*(b[0] - a[0]);
} 


function drawTriangle(imageData, a, b, c, color)
{
    // Sort the points. We want a.y < b.y < c.y. Note that (0, 0) is the topleft
    // of the screen, so a will be the highest point, then b, then c. Since we're
    // sorting them this way, we know the highest y value will always be a.y, and
    // the lowest y value will always be c.y. This simplifies our algorithm quite a bit!

    var temp;
    if(a[1] > b[1])
    {
        temp = a;
        a = b;
        b = temp;
    }
    if(a[1] > c[1])
    {
        temp = a;
        a = c;
        c = temp;
    }
    if(b[1] > c[1])
    {
        temp = b;
        b = c;
        c = temp;
    }

    // We want the coordinates of each point on the triangle to be integers.
    // Otherwise, we'll see ugly artifacts along the edges.
    a[0] = Math.floor(a[0]); a[1] = Math.floor(a[1]);
    b[0] = Math.floor(b[0]); b[1] = Math.floor(b[1]);
    c[0] = Math.floor(c[0]); c[1] = Math.floor(c[1]);

    // Calculate the slope of each edge of the triangle.
    var abSlope = (a[1] - b[1]) / (a[0] - b[0]);
    var acSlope = (a[1] - c[1]) / (a[0] - c[0]);
    var bcSlope = (b[1] - c[1]) / (b[0] - c[0]);

    // We need to be able to access the points of the triangle in a counter-clockwise order,
    // so we'll store the CCW order of the variables in v0, v1, and v2.
    var v0 = a;
    var v1 = b;
    var v2 = c;

    // Given the matrix:
    // | ax ay 1 |
    // | bx by 1 |
    // | cx cy 1 |
    // If the determinant is less than zero, then the points are in CCW order (if the origin is at the topleft).
    // Otherwise, the points are in CW order, and we must swap any two points. Found this trick here:
    // http://gamedev.stackexchange.com/questions/13229/sorting-array-of-points-in-clockwise-order
    var det = a[0]*b[1] + b[0]*c[1] + c[0]*a[1] - b[1]*c[0] - c[1]*a[0] - a[1]*b[0];
    if(det >= 0)
    {
        v1 = c;
        v2 = b;
    }

    var area = edgeFunction(v0, v1, v2);

    // Now we'll draw each horizontal line of the triangle.
    for(var y = a[1]; y < c[1]; y++)
    {
        // First, we determine the x values of each end of the strip of the triangle
        // we're drawing. Because we sorted the points of the triangle by height alphabetically,
        // we know that if a given y on the triangle is higher than b, then the two edges will
        // be ab and ac, and if the y value is lower than the point b, then the two edges will
        // be bc and ac. 
        var x1, x2;
        if(y < b[1])
            x1 = (y - a[1])/abSlope + a[0];
        else
            x1 = (y - b[1])/bcSlope + b[0];
        x2 = (y - a[1])/acSlope + a[0];

        // For algorithmic purposes, we want x1 to be to the left of x2, so we ensure this here.
        if(x2 < x1)
        {
            temp = x1;
            x1 = x2;
            x2 = temp;
        }

        // We don't want to draw things that are very far away "in front of" nearby objects. To do this,
        // we use a Z-buffer to store the Z-value of each pixel, and only draw over that pixel when the
        // program finds a closer pixel.

        for(var x = Math.floor(x1); x <= Math.floor(x2); x++)
        {
            var p = [x, y, 0];
            var w0 = edgeFunction(v1, v2, p);
            var w1 = edgeFunction(v2, v0, p);
            var w2 = edgeFunction(v0, v1, p);

            if(w0 >= 0 && w1 >= 0 && w2 >= 0) //z < depthBuffer[y][x])
            {
                w0 /= area;
                w1 /= area;
                w2 /= area;

                // Now, we only draw the new pixel if it's nearer to the camera than the existing pixel.
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
    if(distSquared != 1)
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

function drawTriangle3D(triangles, colors, transform, imageData)
{
    for(var i = 0; i < triangles.length; i++)
    {
        // For each edge, we have two points. First, we apply the transformation
        // to both points.
        var a = matrix44MultiplyVector3(transform, triangles[i][0], 1);
        var b = matrix44MultiplyVector3(transform, triangles[i][1], 1);
        var c = matrix44MultiplyVector3(transform, triangles[i][2], 1);

        // Now we project the point from 4D into 3D using our perspective matrix.
        // To project the 3D coordinates into 2D, we simply ignore the z value and
        // draw the (x, y) coordinates. (This is essentially an orthographic projection.)
        var projA = transformCoordinate(perspectiveMatrix, a);
        var projB = transformCoordinate(perspectiveMatrix, b);
        var projC = transformCoordinate(perspectiveMatrix, c);

        // don't draw triangles that are outside the screen's boundaries
        if((projA[0] < -1 || projA[0] > 1 || projA[1] < -1 || projA[1] > 1) &&
           (projB[0] < -1 || projB[0] > 1 || projB[1] < -1 || projB[1] > 1) &&
           (projC[0] < -1 || projC[0] > 1 || projC[1] < -1 || projC[1] > 1))
            continue;

        // Convert the normalized coordinates (-1.0 to 1.0) to pixel-space
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

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);

    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    clearDepthBuffer();

    var T = getIdentityMatrix();
    T = translate(T, 0, 0, -5);
    T = rotate(T, angle, 1, 0, 0);
    T = rotate(T, angle, 0, 1, 0);
    drawTriangle3D(tetrahedronTriangles, tetrahedronColors, T, imageData);
    T = scale(T, -1, -1, -1);
    drawTriangle3D(tetrahedronTriangles, tetrahedronColors, T, imageData);

    T = getIdentityMatrix();
    T = translate(T, 10, -10, -30);
    T = rotate(T, angle * 4, 0, 0, 1);
    T = rotate(T, angle * 4, 0, 1, 0);
    drawTriangle3D(cubeTriangles, cubeColors, T, imageData);

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
