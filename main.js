
var canvas = document.getElementsByTagName('canvas')[0];
var c = canvas.getContext('2d');


//TODO: Integrate dat.GUI
//TODO: Show/Store Generation

//Initialize canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function Sigmoid(x){
    return 1.0/(1.0+Math.exp(-x));
}
function Distance(veca, vecb){
    var dx = veca[0]-vecb[0];
    var dy = veca[1]-vecb[1];
    return Math.sqrt(dx*dx+dy*dy);
}

const WORLD_WIDTH = 256;
const WORLD_HEIGHT = 256;
const WORLD_HISTOGRAM_SIZE = 128;
const WORLD_RANDOM_AGENT_SPAWN_RATE = 0.1;
const FOOD_RADIUS = 1;
class World{
    constructor(numAgents, maxFood){
        this.agents = [];
        this.foods = [];
        this.toRemoveFoods = [];
        this.toRemoveAgents = [];
        this.time = 0;
        this.numAgents = numAgents;
        this.maxFood = maxFood;
        this.generation = 0;
        this.nextIsFood = true;
        this.histogram = [];

        for(var i = 0; i < numAgents; i++){
            this.agents.push(new Agent());
        }
    }
    update(dt){
        //Add food
        if(this.foods.length < this.maxFood){
            var foodProportion = this.foods.length > 0 ? this.foods.reduce((last, food)=>last+food[2]) : 1;
            this.foods.push([
                Math.random()*WORLD_WIDTH,
                Math.random()*WORLD_HEIGHT,
                this.nextIsFood ? 1 : 1,
            ]);
            this.nextIsFood = !this.nextIsFood;
        }

        //Update Agents
        for(var agent of this.agents){
            agent.update(dt);
        }

        //Agent vs Agent Collision
        for(var agenta of this.agents){
            for(var agentb of this.agents){
                var dx = agenta.position[0] - agentb.position[0];
                var dy = agenta.position[1] - agentb.position[1];
                var d = Math.sqrt(dx*dx+dy*dy);
                if(d != 0 && d < AGENT_RADIUS*2.0){
                    //Normalize difference
                    dx /= d;
                    dy /= d;

                    var x = (2*AGENT_RADIUS-d)*0.5;
                    agenta.position[0] += dx*x;
                    agenta.position[1] += dy*x;
                    agentb.position[0] -= dx*x;
                    agentb.position[1] -= dy*x;
                }
            }
        }

        //Agent x Food collision
        for(var food of this.foods){
            for(var agent of this.agents){
                var dx = food[0] - agent.position[0];
                var dy = food[1] - agent.position[1];
                if(Math.sqrt(dx*dx+dy*dy) < AGENT_RADIUS+FOOD_RADIUS){
                    agent.health += food[2] < 0 ? - 50 : 30;
                    agent.health = Math.min(agent.health, AGENT_MAX_HEALTH);
                    this.toRemoveFoods.push(food);
                    break;
                }
            }
        }

        //Agent set target
        for(var agent of this.agents){
            var bestFood = null;
            var bestDist = Infinity;
            for(var food of this.foods){
                var dx = food[0] - agent.position[0];
                var dy = food[1] - agent.position[1];
                var d = Math.sqrt(dx*dx+dy*dy);
                if(d < bestDist){
                    bestDist = d;
                    bestFood = food;
                }
            }
            agent.target = bestFood;
        }

        //Detect Dead Agents
        for(var agent of this.agents){
            if(agent.health <= 0){
                this.toRemoveAgents.push(agent);
            }
        }

        //Remove Foods
        if(this.toRemoveFoods.length > 0){
            this.foods = this.foods.filter((food)=> this.toRemoveFoods.indexOf(food) == -1);
            this.toRemoveFoods = [];
        }

        //Remove Agents
        if(this.toRemoveAgents.length > 0){
            this.agents = this.agents.filter((agent)=> this.toRemoveAgents.indexOf(agent) == -1);

            //Respawn Agents
            if(this.agents.length < 5){
                while(this.agents.length < this.numAgents){

                    //Some agents need to be a brand random new
                    //This prevents the local minima
                    if(Math.random() < WORLD_RANDOM_AGENT_SPAWN_RATE){
                        this.agents.push(new Agent());
                    }else{
                        var parent = this.toRemoveAgents[Math.floor(Math.random()*this.toRemoveAgents.length)];
                        var a = new Agent();
                        a.brain.mutateFrom(parent.brain);
                        this.agents.push(a);
                    }
                }

                //Add Generation to histogram
                this.histogram.push(parent.lifeTime);
                if(this.histogram.length > WORLD_HISTOGRAM_SIZE)this.histogram.splice(0, 1);
                this.generation++;
            }

            this.toRemoveAgents = [];
        }
    }
    render(){
        //Render Scene Boundary
        c.strokeRect(0,0, WORLD_WIDTH, WORLD_HEIGHT);

        //Render Foods
        for(var food of this.foods){
            c.beginPath();
            c.fillStyle = food[2] < 0 ? 'rgb(255,0,0)' : 'rgb(0,255,0)';
            c.arc(food[0], food[1], FOOD_RADIUS, 0, Math.PI*2);
            c.closePath();
            c.fill();
        }

        //Render Agents
        c.fillStyle = 'rgb(255,0,0)';
        for(var agent of this.agents){
            agent.render();
        }
        
    }
}

const AGENT_RADAR_LENGTH = 7;
const AGENT_RADIUS = 4;
const AGENT_VELOCITY = 0.1;
const AGENT_TURN_SPEED = 0.02;
const AGENT_MAX_HEALTH = 100;
class Agent{
    constructor(){
        this.health = 100;
        this.brain = new Brain();
        this.target = null;
        this.radar0pos = [0,0];
        this.radar1pos = [0,0];
        this.position = [
            Math.random()*WORLD_WIDTH,
            Math.random()*WORLD_HEIGHT,
        ];
        this.rotation = Math.random()*Math.PI*2;
        this.lifeTime = 0.0;
    }
    update(dt){
        //Increase lifeTime
        this.lifeTime += dt;

        //Calculate Radar Position
        this.radar0pos = [
            this.position[0]+Math.cos(this.rotation-0.3)*AGENT_RADAR_LENGTH,
            this.position[1]+Math.sin(this.rotation-0.3)*AGENT_RADAR_LENGTH,
        ];
        this.radar1pos = [
            this.position[0]+Math.cos(this.rotation+0.3)*AGENT_RADAR_LENGTH,
            this.position[1]+Math.sin(this.rotation+0.3)*AGENT_RADAR_LENGTH,
        ];

        //Border Collision
        if(this.position[0] < AGENT_RADIUS){
            this.position[0] = AGENT_RADIUS;
        }
        if(this.position[1] < AGENT_RADIUS){
            this.position[1] = AGENT_RADIUS;
        }
        if(this.position[0] > WORLD_WIDTH-AGENT_RADIUS){
            this.position[0] = WORLD_WIDTH-AGENT_RADIUS;
        }
        if(this.position[1] > WORLD_HEIGHT-AGENT_RADIUS){
            this.position[1] = WORLD_HEIGHT-AGENT_RADIUS;
        }

        //Run Brain if has target
        if(this.target != null){
            var radar0 = Distance(this.radar0pos, this.target);
            var radar1 = Distance(this.radar1pos, this.target);

            //Forward Brain
            var output = this.brain.forward([radar0, radar1, this.target[2]]);
            
            //Movement
            this.rotation += (output[0] - 0.5)*dt*AGENT_TURN_SPEED; //Minus 0.5 because Sigmoid is between 0 and 1
            this.position[0] += Math.cos(this.rotation)*AGENT_VELOCITY*dt*output[1];
            this.position[1] += Math.sin(this.rotation)*AGENT_VELOCITY*dt*output[1];

            //Health Decrease (According to turn/movement velocity)
            this.health -= dt*0.01*(Math.abs(output[0]-0.5)+output[1]+0.5);
        }

    }
    render(){

        c.lineCap = "round";
        c.lineJoin = "round";
        c.beginPath();
        c.lineTo(this.radar0pos[0], this.radar0pos[1]);
        c.lineTo(this.position[0], this.position[1]);
        c.lineTo(this.radar1pos[0], this.radar1pos[1]);
        c.stroke();
        c.closePath();

        c.beginPath();
        c.fillStyle = 'rgb('+Math.floor((100-this.health)*2.55)+','+Math.floor(this.health*2.55)+',0)';
        c.arc(this.position[0], this.position[1], AGENT_RADIUS, 0, Math.PI*2);
        c.fill();
        c.stroke();
        c.closePath();
    }
}


const BRAIN_INPUT = 3;
const BRAIN_HIDDEN = 16;
const BRAIN_OUTPUT = 2;
const BRAIN_TOTAL = BRAIN_INPUT+BRAIN_HIDDEN+BRAIN_OUTPUT;
const BRAIN_MUTATE_RATE = 0.01;
class Brain{
    constructor(){
        this.weights = [];
        for(var i=0; i<BRAIN_TOTAL; i++){
            var w = [];
            for(var j=0; j<BRAIN_TOTAL; j++){
                w[j] = Math.random()*2.0-1.0;
            }
            this.weights[i] = w;
        }
        this.state = [];
        for(var i=0; i<BRAIN_TOTAL; i++){
            this.state[i] = 0.0;
        }
    }
    forward(input){
        for(var i=0; i<BRAIN_INPUT; i++){
            this.state[i] = input[i];
        }
        
        for(var i=BRAIN_INPUT; i<BRAIN_TOTAL; i++){
            var x = 0.0;
            for(var j=0; j<BRAIN_TOTAL-BRAIN_OUTPUT; j++){
                x += this.weights[i][j]*this.state[j];
            }
            this.state[i] = Sigmoid(x);
        }
        return this.state.splice(BRAIN_TOTAL-BRAIN_OUTPUT-1, BRAIN_OUTPUT);
    }
    mutateFrom(parent){
        for(var i=0; i<BRAIN_TOTAL; i++){
            for(var j=0; j<BRAIN_TOTAL; j++){
                this.weights[i][j] = parent.weights[i][j] + (Math.random()*2.0-1.0)*BRAIN_MUTATE_RATE;
                if(Math.random() < BRAIN_MUTATE_RATE){
                    this.weights[i][j] = (Math.random()*2.0-1.0);
                }
            }
            
        }
    }
}

class Camera{
    constructor(){
        this.position = [WORLD_WIDTH/2, WORLD_HEIGHT/2];
        this.scale = 3.0;
        this.isDragging = false;
        canvas.addEventListener('wheel', (e)=>{
            this.lastScale = this.scale;
            this.scale *= 1.0-e.deltaY*0.003;
            if(this.scale < 0.5){
                deltaFactor = this.scale/0.5;
                this.scale = 0.5;
            }
            if(this.scale > 5.0){
                deltaFactor = this.scale/5.0;
                this.scale = 5.0;
            }
            
            var deltaFactor = this.scale/this.lastScale;

        });
        canvas.addEventListener('mousedown', (e)=>{
            this.isDragging = true;
        });
        canvas.addEventListener('mouseup', (e)=>{
            this.isDragging = false;
        });
        canvas.addEventListener('mousemove', (e)=>{
            if(this.isDragging){
                this.position[0] -= e.movementX/this.scale;
                this.position[1] -= e.movementY/this.scale;
            }
        });
    }
    renderWorld(world){
        //Clear Screen
        c.fillStyle = 'rgb(255,255,255)';
        c.fillRect(0,0, canvas.width, canvas.height);

        //Render Overlay
        var maxHist = 0;
        for(var i=0;i<world.histogram.length;i++){
            maxHist = Math.max(maxHist, world.histogram[i]);
        }
        for(var i=0;i<world.histogram.length;i++){
            const WIDTH = 2;
            
            c.fillStyle = (world.histogram[i] == maxHist) ? 'rgb(155,0,0)' : 'rgb(55,55,55)';

            var h = 100.0*world.histogram[i]/maxHist;
            c.fillRect(i*WIDTH, canvas.height-h, 1*WIDTH, h);
        }

        c.fillStyle = 'rgb(155,0,0)';
        c.fillText("Max Survival Time: "+(maxHist/1000).toFixed(2)+"s", 10, canvas.height-100);
        c.fillStyle = 'rgb(55,55,55)';
        c.fillText("Generation: "+world.generation, 10, 10);

        //Render World
        c.save();
        c.translate(canvas.width/2-this.position[0]*this.scale, canvas.height/2-this.position[1]*this.scale);
        c.scale(this.scale, this.scale);
        world.render();
        c.restore();
    }
}

var settings = {
    speed: 1
};
var world = new World(16, 32);
var camera = new Camera();
var gui = new dat.GUI();
gui.add(settings, 'speed', 1, 1000);

var lastTime = 0;
function mainLoop(time){
    var dt = Math.min(time-lastTime, 20);
    for(var i=0;i<settings.speed;i++){
        world.update(dt);
    }

    lastTime = time;
    camera.renderWorld(world);
    requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);



//Controls callbacks
window.onresize = function(e){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}