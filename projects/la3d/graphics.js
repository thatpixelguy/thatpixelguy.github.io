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
    [0, 0, far / (far - near), 1],
    [0, 0, (far * near) / (far - near), 0]
];

function drawHorizontalLine(imageData, x1, x2, y, r, g, b)
{
    for(var x = x1; x < x2; x++)
    {
        var i = (imageData.width * y + x) * 4;
        imageData.data[i + 0] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
    }
};

function drawTriangle(imageData, a, b, c, color)
{
    // Sort the points. We want a.y < b.y < c.y. Note that (0, 0) is the topleft
    // of the screen, so a will be the highest point, then b, then c.
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

    // Calculate the slope of each edge of the triangle.
    var abSlope = (a[1] - b[1]) / (a[0] - b[0]);
    var acSlope = (a[1] - c[1]) / (a[0] - c[0]);
    var bcSlope = (b[1] - c[1]) / (b[0] - c[0]);

    // Draw horizontal lines from edge to edge
    for(var y = a[1]; y <= c[1]; y++)
    {
        var x1, x2;
        if(y < b[1])
            x1 = Math.floor((y - a[1])/abSlope + a[0]);
        else
            x1 = Math.floor((y - b[1])/bcSlope + b[0]);
        x2 = Math.floor((y - a[1])/acSlope + a[0]);

        if(x2 < x1)
        {
            temp = x1;
            x1 = x2;
            x2 = temp;
        }

        // now, calculate the z value
        var d1 = vectorSubtract(a, b);
        var d2 = vectorSubtract(a, c);
        var normal = [d1[1]*d2[2] - d1[2]*d2[1], -(d1[0]*d2[2] - d1[2]*d2[0]), d1[0]*d2[1] - d1[1]*d2[0]];

        for(var x = x1; x < x2; x++)
        {
            var z = (-normal[0]*(x - a[0]) - normal[1]*(y - a[1])) / normal[2] + a[2];

            if(z >= depthBuffer[Math.floor(y)][Math.floor(x)])
            {
                var i = (imageData.width * Math.floor(y) + x) * 4;
                imageData.data[i + 0] = color[0];
                imageData.data[i + 1] = color[1];
                imageData.data[i + 2] = color[2];
                depthBuffer[Math.floor(y)][Math.floor(x)] = z;
            }
        }

        

        //drawHorizontalLine(imageData, x1, x2, Math.floor(y), color[0], color[1], color[2]);
    }
}

function setWorkingCanvas(name)
{
    canvas = document.getElementById(name);
    context = canvas.getContext('2d');

    context.lineWidth = 2;

    viewportWidth = canvas.width;
    viewportHeight = canvas.height;
}

function drawLine(x1, y1, x2, y2, color)
{
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = color;
    context.stroke();
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
    // that OpenGL uses for glRotatef.
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

function drawObject(edges, transform)
{
    for(var i = 0; i < edges.length; i++)
    {
        // For each edge, we have two points. First, we apply the transformation
        // to both points.
        var p1 = matrix44MultiplyVector3(transform, edges[i][0], 1);
        var p2 = matrix44MultiplyVector3(transform, edges[i][1], 1);

        // Now we project the point from 4D into 3D using our perspective matrix.
        // To project the 3D coordinates into 2D, we simply ignore the z value and
        // draw the (x, y) coordinates. (This is essentially an orthographic projection.)
        var projPoint1 = transformCoordinate(perspectiveMatrix, p1);
        var projPoint2 = transformCoordinate(perspectiveMatrix, p2);

        // don't draw line segments that are outside the screen's boundaries
        if((projPoint1[0] < -1 || projPoint1[0] > 1 || projPoint1[1] < -1 || projPoint1[1] > 1) &&
           (projPoint2[0] < -1 || projPoint2[0] > 1 || projPoint2[1] < -1 || projPoint2[1] > 1))
            continue;

        // Convert the normalized coordinates (-1.0 to 1.0) to pixel-space
        var x1 = Math.min(viewportWidth  - 1, ((projPoint1[0] + 1) * 0.5 * viewportWidth)); 
        var y1 = Math.min(viewportHeight - 1, ((1 - (projPoint1[1] + 1) * 0.5) * viewportHeight));
        var x2 = Math.min(viewportWidth  - 1, ((projPoint2[0] + 1) * 0.5 * viewportWidth)); 
        var y2 = Math.min(viewportHeight - 1, ((1 - (projPoint2[1] + 1) * 0.5) * viewportHeight));

        // Fade out lines that are farther away to enhance illusion of depth.
        var threshold = -0.1;
        var depth = 11;
        var color1 = Math.floor(Math.max(threshold + (p1[2] / depth), 0) * 255);
        var color2 = Math.floor(Math.max(threshold + (p2[2] / depth), 0) * 255);

        var gradient = context.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, "rgb(" + color1 + "," + color1 + "," + color1 + ")");
        gradient.addColorStop(1, "rgb(" + color2 + "," + color2 + "," + color2 + ")");

        drawLine(x1, y1, x2, y2, gradient);
    }
}

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

        // don't draw line segments that are outside the screen's boundaries
        if((projA[0] < -1 || projA[0] > 1 || projA[1] < -1 || projA[1] > 1) &&
           (projB[0] < -1 || projB[0] > 1 || projB[1] < -1 || projB[1] > 1) &&
           (projC[0] < -1 || projC[0] > 1 || projC[1] < -1 || projC[1] > 1))
            continue;

        // Convert the normalized coordinates (-1.0 to 1.0) to pixel-space
        var screenA = convertToPixelCoordinates(projA);
        var screenB = convertToPixelCoordinates(projB);
        var screenC = convertToPixelCoordinates(projC);

        drawTriangle(imageData, screenA, screenB, screenC, colors[i]);

        //drawLine(x1, y1, x2, y2, gradient);
    }
}

var angle = 0;
var tetrahedron, cube;

var cubeTriangles = [
    // top face
    [[-1, -1,  1], [ 1, -1,  1], [ 1, -1, -1]],
    [[ 1, -1, -1], [-1, -1, -1], [-1, -1,  1]],

    // bottom face
    [[-1,  1,  1], [ 1,  1,  1], [ 1,  1, -1]],
    [[ 1,  1, -1], [-1,  1, -1], [-1,  1,  1]],

    // back face
    [[-1, -1,  1], [-1,  1,  1], [ 1,  1,  1]],
    [[ 1,  1,  1], [ 1, -1,  1], [-1, -1,  1]],

    // front face
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
    [255, 0, 0], [255, 0, 0],
    [0, 255, 0], [0, 255, 0],
    [0, 0, 255], [0, 0, 255],
    [255, 255, 0], [255, 255, 0],
    [0, 255, 255], [0, 255, 255],
    [255, 0, 255], [255, 0, 255]
];

function clearDepthBuffer()
{
    depthBuffer = [];
    for(var y = 0; y < imageData.height; y++)
    {
        depthBuffer[y] = [];
        for(var x = 0; x < imageData.width; x++)
        {
            depthBuffer[y][x] = 0;
        }
    }
}

function init()
{
    tetrahedron = [
        [[ 1,  0, -0.71], [-1,  0, -0.71]],
        [[-1,  0, -0.71], [ 0,  1,  0.71]],
        [[ 0,  1,  0.71], [ 0, -1,  0.71]],
        [[ 0, -1,  0.71], [ 1,  0, -0.71]],
        [[ 0, -1,  0.71], [-1,  0, -0.71]],
        [[ 1,  0, -0.71], [ 0,  1,  0.71]]
    ];

    cube = [
        // top face
        [[-1, -1,  1], [ 1, -1,  1]],
        [[ 1, -1,  1], [ 1, -1, -1]],
        [[ 1, -1, -1], [-1, -1, -1]],
        [[-1, -1, -1], [-1, -1,  1]],

        // bottom face
        [[-1,  1,  1], [ 1,  1,  1]],
        [[ 1,  1,  1], [ 1,  1, -1]],
        [[ 1,  1, -1], [-1,  1, -1]],
        [[-1,  1, -1], [-1,  1,  1]],

        // vertical edges
        [[-1, -1,  1], [-1, 1,  1]],
        [[ 1, -1,  1], [ 1, 1,  1]],
        [[ 1, -1, -1], [ 1, 1, -1]],
        [[-1, -1, -1], [-1, 1, -1]]
    ];

    // 12 triangles that make form a cube.
    
    //clearDepthBuffer();

    toggleAnimation();
}

function draw()
{
    angle += 0.01;

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);

    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    clearDepthBuffer();

    var T = getIdentityMatrix();
    T = translate(T, 0, 1, 10);
    T = rotate(T, angle, 1, 0, 0);
    T = rotate(T, angle, 0, 1, 0);
    drawTriangle3D(cubeTriangles, cubeColors, T, imageData);

    T = getIdentityMatrix();
    T = translate(T, 0, -1, 7);
    T = rotate(T, angle, 0, 0, 1);
    T = rotate(T, angle, 0, 1, 0);
    //drawObject(cube, T);

    

    drawTriangle(imageData, [40, 10], [20, 50], [60, 30], [0, 0, 0]);

    
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
