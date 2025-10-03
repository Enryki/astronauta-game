const scale = 20;
const wobbleSpeed = 8, wobbleDist = 0.07;
const playerXSpeed = 7, gravity = 30, jumpSpeed = 17;

var sons = new Array();
sons[0] = new Audio('sons/pulo.mp3');
sons[1] = new Audio('sons/moeda.mp3');
sons[2] = new Audio('sons/music.mp3');
sons[3] = new Audio('sons/morte.mp3');
sons[4] = new Audio('sons/fasecompleta.mp3')

class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  plus(other) {
    return new Vector(this.x + other.x,
                      this.y + other.y);
  }

  times(number) {
    return new Vector(this.x * number, this.y * number);
  }
}

function elt(tag, attrs, ...childs) {
  let elem = document.createElement(tag);
  for (let attr of Object.keys(attrs)) {
    elem.setAttribute(attr, attrs[attr]);
  }
  for (let child of childs) {
    elem.appendChild(child);
  }

  return elem;
}

function collapse(actor1, actor2) {
  return actor1.pos.x + actor1.size.x > actor2.pos.x &&
         actor1.pos.x < actor2.pos.x + actor2.size.x &&
         actor1.pos.y + actor1.size.y > actor2.pos.y &&
         actor1.pos.y < actor2.pos.y + actor2.size.y;
}

function trackKeys(keys) {
  let keysdown = Object.create(null);
  function key(event) {
    if (keys.includes(event.key)) {
      keysdown[event.key] = event.type == "keydown";
      event.preventDefault();
    }
  }

  window.addEventListener("keyup", key);
  window.addEventListener("keydown", key);

  keysdown.clearEvents = function() {
    window.removeEventListener("keyup", key);
    window.removeEventListener("keydown", key);
  };
  
  return keysdown;
}

class Level {
  constructor(plan) {
    let rows = plan.trim().split("\n").map(str => [...str]);
    this.width = rows[0].length;
    this.height = rows.length;
    this.startActors = [];

    this.rows = rows.map((row, y) => {
      return row.map((char, x) => {
        let type = charRef[char];
        if (typeof type == "string") return type;
        this.startActors.push(type.create(new Vector(x, y), char));
        return "empty";
      });
    });
  }

  touches(pos, size, type) {
    let x0 = Math.floor(pos.x);
    let x1 = Math.ceil(pos.x + size.x);
    let y0 = Math.floor(pos.y);
    let y1 = Math.ceil(pos.y + size.y);

    for (let y = y0 ; y < y1 ; ++y) {
      for (let x = x0 ; x < x1 ; ++x)  {
        let isOutside = x < 0 || x >= this.width ||
                        y < 0 || y >= this.height;
        let elType = isOutside ? "wall" : this.rows[y][x];
        if (elType == type) return true;
      }
    }

    return false;
  }
}

class State {
  constructor(level, actors, status) {
    this.level = level;
    this.actors = actors;
    this.status = status;
  }

  get player() { 
    sons[2].play().catch(err => {}); 
    return this.actors.find(a => a.type == "player")
  };

  static start(level) {
    return new State(level, level.startActors, "playing");
  }

  update(time, keys) {
    let actors = this.actors.map(actor => actor.update(time, this, keys));
    let newState = new State(this.level, actors, this.status);
    if (newState.status != "playing") return newState;

    let player = newState.player;
    if (this.level.touches(player.pos, player.size, "lava")) {
      sons[3].play().catch(err => {}); 
      return new State(this.level, actors, "lost");
    }

    for (let actor of actors) {
      if (actor != player && collapse(player, actor)) {
        newState = actor.collide(newState);
      }
    }

    return newState;
  }
}

class Lava {
  constructor(pos, speed, reset) {
    this.pos = pos;
    this.speed = speed;
    this.reset = reset;
  }

  get type() { return "lava"; }

  static create(pos, char) {
    if (char == "=") {
      return new Lava(pos, new Vector(2, 0));
    } else if (char == "|") {
      return new Lava(pos, new Vector(0, 2));
    } else if (char == "v") {
      return new Lava(pos, new Vector(0, 3), pos);
    }
  }

  collide(state) {
    sons[3].play().catch(err => {});; 
    return new State(state.level, state.actors, "lost");
  }

  update(time, state) {
    let newPos = this.pos.plus(this.speed.times(time));
    if (!state.level.touches(newPos, this.size, "wall")) {
      return new Lava(newPos, this.speed, this.reset);
    } else if(this.reset) {
      return new Lava(this.reset, this.speed, this.reset);
    } else {
      return new Lava(this.pos, this.speed.times(-1));
    }
  }
}

Lava.prototype.size = new Vector(1, 1);

class Player {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  get type() { return "player"; }

  static create(pos) {
    pos = pos.plus(new Vector(0, -0.5));
    return new Player(pos, new Vector(0, 0));
  }

  update(time, state, keys) {
    let speedX = 0;
    if (keys.ArrowLeft) speedX -= playerXSpeed;
    if (keys.ArrowRight) speedX += playerXSpeed;

    let pos = this.pos;
    let newX = pos.plus(new Vector(speedX * time, 0));
    if (!state.level.touches(newX, this.size, "wall")) {
      pos = newX;
    }

    let speedY = this.speed.y + gravity * time;
    let newY = pos.plus(new Vector(0, speedY * time));
    if (!state.level.touches(newY, this.size, "wall")) {
      pos = newY;
    } else if (speedY > 0 && keys.ArrowUp) {
      sons[0].play().catch(err => {});
      speedY = -jumpSpeed;
    } else {
      speedY = 0;
    }

    return new Player(pos, new Vector(speedX, speedY));
  }
}

Player.prototype.size = new Vector(0.8, 1.5);

class Coin {
  constructor(pos, basePos, wobble) {
    this.pos = pos;
    this.basePos = basePos;
    this.wobble = wobble;
  }

  get type() { return "coin"; }

  static create(pos) {
    pos = pos.plus(new Vector(0.2, 0.1));
    return new Coin(pos, pos, Math.random() * 2 * Math.PI);
  }

  collide(state) {
    let filtered = state.actors.filter(actor => actor != this);
    let status = state.status;
    sons[1].currentTime = 0;
    sons[1].play().catch(err => {});
    if (!filtered.some(actor => actor.type == "coin")) status = "won";
    return new State(state.level, filtered, status);
  }

  update(time) {
    let wobble = this.wobble + wobbleSpeed * time;
    let posY = Math.sin(wobble) * wobbleDist;
    return new Coin(this.basePos.plus(new Vector(0, posY)), this.basePos, wobble);
  }
}

Coin.prototype.size = new Vector(0.6, 0.6); 

class Monster {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  get type() { return "monster"; }

  static create(pos) {
    return new Monster(pos.plus(new Vector(0, -1)), new Vector(3, 0));
  }

  collide(state) {
    let player = state.player;
    if (player.pos.y + player.size.y < this.pos.y + 0.5) {
      let filtered = state.actors.filter(a => a != this);
      return new State(state.level, filtered, state.status);
    } else {
      return new State(state.level, state.actors, "lost");
    }
  }

  update(time, state) {
    let newPos = this.pos.plus(this.speed.times(time));
    if (!state.level.touches(newPos, this.size, "wall")) {
      return new Monster(newPos, this.speed);
    } else {
      return new Monster(this.pos, this.speed.times(-1));
    }
  }
}

Monster.prototype.size = new Vector(1.2, 2);

const charRef = {
  ".": "empty", "#": "wall", "+": "lava",
  "@": Player, "o": Coin, "M": Monster,
  "=": Lava, "|": Lava, "v": Lava
};

// DOM elements based display

function drawGrid(level) {
  return elt("table", {
    "class": "background",
    "style": `width: ${level.width * scale}px`
  }, ...level.rows.map(row => 
    elt("tr", {"style": `height: ${scale}px`}, 
    ...row.map(type => elt("td", {"class": type})))));
}

function drawActors(actors) {
  return elt("div", {}, ...actors.map(actor => {
    let htmlActor = elt("div", {"class": `actor ${actor.type}`});
    htmlActor.style.width = `${actor.size.x * scale}px`;
    htmlActor.style.height = `${actor.size.y * scale}px`;
    htmlActor.style.left = `${actor.pos.x * scale}px`;
    htmlActor.style.top = `${actor.pos.y * scale}px`;

    return htmlActor;
  }));
}

// Runs the game

function runAnimation(frameFunc) {
  let lastTime = null;
  function frame(time) {
    if (lastTime != null) {
      let timeStep = Math.min(time - lastTime, 100) / 1000;
      if (frameFunc(timeStep) === false) return;
    }

    lastTime = time;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function runLevel(level, Display, lives) {
  let display = new Display(document.body, level, lives);
  let state = State.start(level);
  const arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"]);

  let end = 1;
  let paused = false;

  return new Promise(resolve => {
    function frameFunc(time) {
      state = state.update(time, arrowKeys);
      display.syncState(state);
      if (paused) {
        return false;
      } else if (state.status == "playing") {
        return true;
      } else if (end > 0) {
        end -= time;
        return true;
      } else {
        display.clear();
        arrowKeys.clearEvents();
        resolve(state.status);
        return false;
      }
    }

    window.addEventListener("keyup", (event) => {
      if (event.key == "Escape") {
        paused = !paused;
  
        if (!paused) {
          runAnimation(frameFunc);
        }
      }
    });

    runAnimation(frameFunc);
  });
}

async function runGame(levels, Display) {
  let lives = 3;
  for (let i = 0 ; i < levels.length ; ) {
    console.log("Lives: ", lives);
    let status = await runLevel(new Level(levels[i]), Display, lives);

    if (status == "won") ++i;
    else --lives; 

    if (lives == 0) {
      console.log("You lost!");
      setTimeout(runGame, 1500, GAME_LEVELS, CanvasDisplay);
      return;
    }
  }

  console.log("You beat the game!!");
}

function flipHorizontally(context, around) {
  context.translate(around, 0);
  context.scale(-1, 1);
  context.translate(-around, 0);
}

let otherSprites = document.createElement("img");
otherSprites.src = "./img/sprites.png";

let playerSprites = document.createElement("img");
playerSprites.src = "./img/player.png";
let playerXOffset = 4;

let lifeImage = document.createElement("img");
lifeImage.src = "./img/life.png";
let lifeImageSize = 30;

class CanvasDisplay {
  constructor(parent, level, lives) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.min(600, level.width * scale);
    this.canvas.height = Math.min(450, level.height * scale);
    parent.appendChild(this.canvas);
    this.cx = this.canvas.getContext("2d");
    
    this.lives = lives;
    this.flipPlayer = false;

    this.viewport = {
      left: 0,
      top: 0,
      width: this.canvas.width / scale,
      height: this.canvas.height / scale
    }
  }

  clear() { this.canvas.remove(); }

  syncState(state) {
    this.updateViewport(state);
    this.clearDisplay(state.status);
    this.drawBackground(state.level);
    this.drawActors(state.actors);
  }

  updateViewport(state) {
    let view = this.viewport, margin = this.viewport.width / 3;
    let player = state.player;
    let center = player.pos.plus(player.size.times(0.5));

    if (center.x < view.left + margin) {
      view.left = Math.max(center.x - margin, 0);
    } else if (center.x > view.left + view.width - margin) {
      view.left = Math.min(center.x + margin - view.width, 
                           state.level.width - view.width);
    }

    if (center.y < view.top + margin) {
      view.top = Math.max(center.y - margin, 0);
    } else if (center.y > view.top + view.height - margin) {
      view.top = Math.min(center.y + margin - view.height, state.level.height - view.height);
    }
  }

  clearDisplay(status) {
    if (status == "won") {
      sons[4].play().catch(err => {});
      this.cx.fillStyle = "rgb(0, 128, 0)";
    } else if (status == "lost") {
      this.cx.fillStyle = "rgb(0, 0, 0)";
    } else {
      this.cx.fillStyle = "rgb(0, 100, 0)";
    }

    this.cx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground(level) {
    let {left, top, width, height} = this.viewport;
    let xStart = Math.floor(left);
    let xEnd = Math.ceil(left + width);
    let yStart = Math.floor(top);
    let yEnd = Math.ceil(top + height);

    for (let y = yStart ; y < yEnd ; ++y) {
      for (let x = xStart ; x < xEnd ; ++x) {
        let tile = level.rows[y][x];
        if (tile == "empty") continue;
        let posX = (x - left) * scale;
        let posY = (y - top) * scale;
        let tileX = tile == "lava" ? scale : 0;
        this.cx.drawImage(otherSprites, tileX, 0, scale, scale, 
                                      posX, posY, scale, scale);
      }
    }

    for( let i = 0 ; i < this.lives ; ++i) this.cx.drawImage(lifeImage, 10 + i * lifeImageSize, 10, lifeImageSize, lifeImageSize);
  }

  drawPlayer(player, x, y, width, height) {
    width += playerXOffset * 2;
    x -= playerXOffset;
    if (player.speed.x != 0) {
      this.flipPlayer = player.speed.x < 0;
    }

    let tile = 8;
    if (player.speed.y != 0) {
      tile = 9;
    } else if (player.speed.x != 0) {
      tile = Math.floor(Date.now() / 60) % 8;
    }

    this.cx.save();
    if (this.flipPlayer) {
      flipHorizontally(this.cx, x + width / 2);
    }
    let tileX = tile * width;
    this.cx.drawImage(playerSprites, tileX, 0, width, height, 
                                         x, y, width, height);
    this.cx.restore();

  }

  drawActors(actors) {
    for (let actor of actors) {
      let width = actor.size.x * scale;
      let height = actor.size.y * scale;
      let x = (actor.pos.x - this.viewport.left) * scale;
      let y = (actor.pos.y - this.viewport.top) * scale;
      if (actor.type == "player") {
        this.drawPlayer(actor, x, y, width, height);
      } else {
        let tileX = (actor.type == "coin" ? 2 : 1) * scale;
        this.cx.drawImage(otherSprites, tileX, 0, width, height , x, y, width, height);
      }
    }
  }

}

var GAME_LEVELS = [`                                     
................................................................................
................................................................................
................................................................................
................................................................................
................................................................................
..##........................................................................##..
..#..........................................................................#..
..#..........................................................................#..
..#..........................................................................#..
..#.............o............................................................#..
..#.............#................................o...........................#..
..#.............................................###..........................#..
..#.......o..................................................................#..
..#.......#...#####........................o.................................#..
..#.......................................###........#.......................#..
..#..........................................................................#..
..#.@.................o....................................o..............o..#..
..##########################......#####.................#######......#########..
...........................#++++++#...#+++++++++++++++++#.....#++++++#..........
...........................#++++++#...#+++++++++++++++++#.....#++++++#..........
...........................#++++++#...#+++++++++++++++++#.....#++++++#..........
...........................########...###################.....########..........
................................................................................
................................................................................
`,`                                                                    
................................................................................
................................................................................
................................................................................
................................................................................
..##............................................................................
..#.............................................................................
..#..................................................................##.........
..#...................................................................#.........
..#...................................................................#.........
..#..........ooo....................oo................................#.........
..#.....###########..............########.............................#.........
..#=......#.......#......oo......#.......#............................#.........
..#.......#.......#++++++##++++++#........#...........................#.........
..#o......#.......#++++++##++++++#.........#.......o......o.........oo#.........
..###.....#.......#++++++##++++++#..........#=.....#.....=#=.....######.........
..#......=#.......################...........##########################.........
..#.......#.....................................................................
..#......o#.....................................................................
..#.....###.....................................................................
..#=......#.....................................................................
..#.......#.....................................................................
..#o......#.....................................................................
..###.....#.....................................................................
..#......=#.....................................................................
..#.......#.....................................................................
..#......o#.....................................................................
..#.....###.....................................................................
..#=......#.....................................................................
..#.......#.....................................................................
..#.@...oo#.....................................................................
..#########.....................................................................
................................................................................
`,`
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
..................................................................................................................
........................................................................#.........................................
..##############################################..................###..........................................#..
..#.........#####............#########.............................#...........................................#..
..#.........v###v............v###v###v.............................v...........................................#..
..#...........#................#...#........................................#..................................#..
..#...........v................v...v...........................................................................#..
..#...................................................................o........................................#..
..#...................................................................#........................................#..
..#............................................................................................................#..
..#............................................................................................................#..
..#......................................................o......#..............................................#..
..#.@..oo.....o.....ooo..........o.......................#..................................o...o.....oooo..o..#..
..###########################################........................................###########################..
............................................#..#.....................................#............................
............................................#.....#..................................#............................
............................................#++++++++++++++++++++++++++++++++++++++++#............................
............................................#++++++++++++++++++++++++++++++++++++++++#............................
............................................##########################################............................
`,`    
................#.............................................................................................
...............#v#............................................................................................
..............#v.v#...........................................................................................
.............#v...v#..........................................................................................
............#v.....v#.......##......................####......................................................
...#########.........#######vv#######################vv####################################################...
...#......................#....#..........................................................##.....|....=...#...
...#......................#....v..........................................................##......o.......#...
...#......................v...............................................................##.|..=.........#...
...#......................................................................................##........|....=#...
...#......................................................................................##=.............#...
...#......................................................................................................#...
...#............o..............oooo............................................o..........oo...|..........#...
...#o#####################################........................=######....########################..|..#...
...#o#...................................#=......o........o........#....#.................##......#|.....#....
...#o#...................................#.......#........#........#....#.................##.....#......#.....
...#o#...................................#+++++++++++++++++++++++++#....#......|..........##....#......#......
...#o#...................................#+++++++++++++++++++++++++#....#......o..........##...#......#.......
...#o#...................................###########################....#.....###.........##..#......#........
...#o#.............................................................##...#.......|#........##.#......#.........
...#o#..............................................................#....#........#=......###.....=#..........
...#o#..............................................................##....#........#..............#...........
...#o#...............................................................#.....#=.......#............#............
...#o#...............................................................#......#.......=#..........#.............
...#o#...............................................................#.......#........#........#..............
...#o#...............................................................#........#........#......#...............
...#o#...............................................................#.........#........#.oo.#................
...#o#...............................................................#..........#.......|###################..
...#o................................................................#...........#.....=.#.................#..
...#o....oooooooooooooooooooooooooooooooooooooooooooooooooooooooo....#............#......#.................#..
...###################################################################.............#.......................#..
....................................................................................#|.......oooooo......@.#..
......#####.#..#..#.#..###.####.###..###.#...####.#.#.#.#...#.####...................#######################..
........#...#..#...#...#...#..#.#.#..#.#.#...#..#..#..#.##..#.#...............................................
........#...####..#.#..###.#..#.###..###.#...####..#..#.#.#.#.#.##............................................
........#...#..#.#...#.#...####.#..#.#...###.#..#..#..#.#..##.####............................................         
`];

runGame(GAME_LEVELS, CanvasDisplay);