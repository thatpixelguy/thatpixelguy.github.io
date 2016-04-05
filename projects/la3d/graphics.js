'use strict';

var canvas = null;
var context = null;

var viewportWidth;
var viewportHeight;

var fov  = 60;
var near = 0.1;
var far  = 1000;
var s    = 1 / Math.tan(fov * 0.5 * Math.PI / 180);

var perspectiveMatrix = [
    [s, 0, 0, 0],
    [0, s, 0, 0],
    [0, 0, -far / (far - near), -1],
    [0, 0, -(far * near) / (far - near), 0]
];

function setWorkingCanvas(name)
{
    canvas = document.getElementById(name);
    context = canvas.getContext('2d');

    context.lineWidth = 3;

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

class Shape
{
    constructor(edges)
    {
        this.edges = edges;
    }

    scale(scalar)
    {
        for(var i = 0; i < this.edges.length; i++)
        {
            this.edges[i][0] = vectorScale(this.edges[i][0], scalar);
            this.edges[i][1] = vectorScale(this.edges[i][1], scalar);
        }
    }

    translate(x, y, z)
    {
        for(var i = 0; i < this.edges.length; i++)
        {
            this.edges[i][0][0] += x;
            this.edges[i][0][1] += y;
            this.edges[i][0][2] += z;

            this.edges[i][1][0] += x;
            this.edges[i][1][1] += y;
            this.edges[i][1][2] += z;
        }
    }

    draw(x, y, z, theta)
    {
        var transform = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];

        transform = matrixMultiply(transform, [
            [Math.cos(theta), 0, Math.sin(theta)],
            [0, 1, 0],
            [-Math.sin(theta), 0, Math.cos(theta)],
        ]);

        transform = matrixMultiply(transform, [
            [1, 0, 0],
            [0, Math.cos(theta), -Math.sin(theta)],
            [0, Math.sin(theta), Math.cos(theta)]
        ]);

        for(var i = 0; i < this.edges.length; i++)
        {
            var p1 = matrixMultiplyVector(transform, this.edges[i][0]);
            var p2 = matrixMultiplyVector(transform, this.edges[i][1]);

            var offset = [x, y, z];

            p1 = vectorAdd(p1, offset);
            p2 = vectorAdd(p2, offset);

            var w;

            var projPoint1 = matrix44MultiplyVector3(perspectiveMatrix, p1);
            var projPoint2 = matrix44MultiplyVector3(perspectiveMatrix, p2);

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
}

var angle = 0;
var tetrahedron, cube;

function init()
{
    tetrahedron = new Shape([

        [[ 1,  0, -0.71], [-1,  0, -0.71]],
        [[-1,  0, -0.71], [ 0,  1,  0.71]],
        [[ 0,  1,  0.71], [ 0, -1,  0.71]],
        [[ 0, -1,  0.71], [ 1,  0, -0.71]],
        [[ 0, -1,  0.71], [-1,  0, -0.71]],
        [[ 1,  0, -0.71], [ 0,  1,  0.71]]
    ]);

    cube = new Shape([

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
    ]);

    cube.scale(1.25);
    tetrahedron.scale(0.75);

    toggleAnimation();
}

function draw()
{
    angle += 0.01;

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);

    cube.draw(2, 2, 10, angle);
    tetrahedron.draw(-1, -1, 4, angle * 3);

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
