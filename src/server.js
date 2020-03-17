// Setting up variables
var expressApp = require("express")();
var httpServer = require("http").Server(expressApp);
const socketIo = require("socket.io");
const config = { pingTimeout: 60000 };
const io = socketIo(httpServer, config);

// listening for connections
var port = Number(process.env.PORT || 8080);

httpServer.listen(port, function () {
  console.log('Server running at http://127.0.0.1:8080');
});


var piecesToGive = []; // Maybe a better way of storing this.
var board = []; // Maybe a better way of storing this.
var teams = {}

expressApp.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Gets the pieces for the specified user in the query. 
// This should be used as /pieces?clientId=<clientid>
expressApp.get('/pieces', function (request, response) {
  response.send(piecesToGive.filter(piece => piece.Owner == request.query["clientId"]));
});

var socketRoom;
io.on("connection", socket => {

  socket.on('join', (room) => {
    var user = io.in(room).clients((err, clients) => {
      // If there are already 4 sockets in a room, do not let the new socket join.
      if (clients.length > 3) { //(0,1,2,3)
        console.log("Sorry this room is full");
        // should throw
      }
      else if (clients.includes(socket.id)) {
        console.log("You are already in the room");
      }
      else {
        // verify if socket is already here (a refresh in the page)
        socket.join(room, () => {
          socketRoom = room; // this shoild be from the url /room
          // If the clients before the new socket joined were 3 then max number reached, begin playing.
          if (clients.length == 3) {
            // ready to begin domino. Shuffle and assign pieces to players.
            let updatedClients = clients;
            updatedClients.push(socket.id);
            CreateDominoPieces(updatedClients);
            CreateTeams(updatedClients);
            console.log(teams);
            io.to(socket.rooms[socketRoom]).emit('BeginDomino', {
              message: "Let's Play! We are 4 in the room already!",
              teams: teams
            });
          }
        });
      }
    });
  });

  // halfPiece is the part of the piece that we are playing with.
  // si tenemos un 5|4, halfpiece nos va a decir si queremos jugar el 5 o el 4
  socket.on("PlayPiece", (piece, halfPiece) => {
    console.log("received piece:");
    console.log(piece.top.value + "|" + piece.bottom.value);

    // first time, halfPiece is null
    if (halfPiece != null)
      console.log("Desired to put it on: " + halfPiece.value);

    // need to figure out how to put it in the right array order maybe...?
    // If starting, push it at the beginning
    if (board.length == 0) {
      piece.top.open = true;
      piece.bottom.open = true;
      board.push(piece);
    }
    // if second piece is going to be played (board has 1 piece)
    else {
      let placeToPutPiece = board.findIndex(boardPiece => (boardPiece.top.open == true && boardPiece.top.value == halfPiece.value)
        || (boardPiece.bottom.open == true && boardPiece.bottom.value == halfPiece.value));
      if (piece.top.value == halfPiece.value) {
        console.log(halfPiece.direction)
        // this case is 6 | 6 on the board and i have 6 | 1
        if (halfPiece.direction == "right") {
          // I clicked on the left so I just need to put the 1 | 6 at the left of the board.
          // I would have 1 | 6 - 6|6.. now the opens are 1 and 6... will figure that out later
          board.push(piece);
        }
        else {
          // I clicked on the right. so I need to invert the 1 |  6 so that its 6| 6 - 6 | 1
          console.log("invert");
          var tempTop = piece.top;
          piece.top = piece.bottom;
          piece.bottom = tempTop;
          board.splice(0, 0, piece);
        }
      }
      else if (piece.bottom.value == halfPiece.value) {
        console.log(halfPiece.direction)
        // this case is 6 | 6 on the board and i have 1|6
        if (halfPiece.direction == "right") {
          // I clicked on the right. so I need to invert the 1 |  6 so that its 6| 6 - 6 | 1
          console.log("invert");
          var tempTop = piece.top;
          piece.top = piece.bottom;
          piece.bottom = tempTop;
          piece.bottom.open = true;
          board.push(piece);
        }
        else {
          // I clicked on the left so I just need to put the 1 | 6 at the left of the board.
          // I would have 1 | 6 - 6|6.. now the opens are 1 and 6... will figure that out later
          board.splice(0, 0, piece);
        }
        console.log("bottom!")
        // piece.top.open = true;
        // board[placeToPutPiece].top.open = false
        // board.splice(0, 0, piece);
      }

      SetOpenEndsOnBoard(board);
    }
    io.to(socket.rooms[socketRoom]).emit("RefreshBoard", {
      board: board,
      pieceIntroduced: piece
    });
  });
});

function CreateTeams(clients) {
  let shuffledArray = shuffle(clients);
  console.log(shuffledArray);
  teams[shuffledArray[0]] = "Team 1";
  teams[shuffledArray[1]] = "Team 1";
  teams[shuffledArray[2]] = "Team 2";
  teams[shuffledArray[3]] = "Team 2";
}

function SetOpenEndsOnBoard(board) {
  board.forEach(piece => {
    piece.top.open = false;
    piece.bottom.open = false;
  });
  board[0].top.open = true;
  board[board.length - 1].bottom.open = true;

}
function CreateDominoPieces(clients) {
  // create the pieces.
  let piecesDealt = ConstructInitialPiecesArray();
  // shuffle the array.
  let shuffledArray = shuffle(piecesDealt);

  // assign every 7 pieces to a client. (we can do this sequentially because we already shuffled the array)
  let clientIndex = 0;
  for (let i = 0; i < 28; i++) {
    if (i % 7 == 0 && i > 0) {
      clientIndex++;
    }
    shuffledArray[i].Owner = clients[clientIndex];
  }

  piecesToGive = shuffledArray;
  console.log(shuffledArray);
}

function ConstructInitialPiecesArray() {
  let piecesDealt = [];
  let j = 0;
  let k = 0;
  for (let i = 0; i < 28; i++) {
    if (k == 7) {
      j++;
      k = j
    }
    let dominoPiece = { top: { value: j }, bottom: { value: k } };
    piecesDealt.push(dominoPiece);
    k++;
  }
  return piecesDealt;
}
// Fisher - Yates shuffle algorithm
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
