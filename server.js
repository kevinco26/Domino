// Setting up variables

var express = require ('express');
var expressApp = express();
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
var teams = {};
var playerTurnOrder = [];
var nextPlayer = 0;

var piecesInPlayerHands;


const path = require('path')

// Serve static files from the React frontend app
expressApp.use(express.static(path.join(__dirname, '/build')))

// Anything that doesn't match the above, send back index.html
expressApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/build/index.html'))
})


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

// Gets the pieces left in each player's hand
// this will be used at the end to compute the score
expressApp.get('/getFinalScore', function (request, response) {
  let scoreTeam1 = 0;
  let scoreTeam2 = 0;
  piecesInPlayerHands.forEach((p) => {
    if (p.Team == 1) {
      scoreTeam1 += p.top.value + p.bottom.value;
    }
    else {
      scoreTeam2 += p.top.value + p.bottom.value;
    }
  });
  let dataTosend = { "team1": scoreTeam1, "team2": scoreTeam2 };
  response.send(dataTosend);
});


var socketRoom;
io.on("connection", socket => {

  socket.on('join', (room) => {
    console.log(room);
    var user = io.in(room).clients((err, clients) => {
      // If there are already 4 sockets in a room, do not let the new socket join.
      if (clients.length > 3) { //(0,1,2,3)
        console.log("Sorry this room is full");
        // should throw error al ux..  oh okay this is full
      }
      else if (clients.includes(socket.id)) {
        console.log("You are already in the room");
      }
      else {
        // verify if socket is already here (a refresh in the page)
        socket.join(room, () => {
          socketRoom = room; // this should be from the url /room
          // If the clients before the new socket joined were 3 - then max number reached, begin playing.
          if (clients.length == 3) {
            // ready to begin domino. Shuffle and assign pieces to players.
            let updatedClients = clients;
            updatedClients.push(socket.id);
            CreateDominoPieces(updatedClients);
            CreatePlayerTurnOrder(updatedClients);
            console.log(teams);
            io.to(socket.rooms[socketRoom]).emit('BeginDomino', {
              message: "Let's Play! We are 4 in the room already!",
              teams: teams,
              playerToStart: playerTurnOrder[0]
            });
          }
        });
      }
    });
  });

  socket.on("Pass", () => {
    nextPlayer++;
    io.to(socket.rooms[socketRoom]).emit("RefreshBoard", {
      board: board,
      pieceIntroduced: null,
      nextPlayer: playerTurnOrder[nextPlayer % 4]
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
      }
    }

    nextPlayer++;
    SetOpenEndsOnBoard(board);

    // Updaet the current pieces that are in the player's hands
    piecesInPlayerHands.splice(piecesInPlayerHands.findIndex(p => (p.top.value == piece.top.value && p.bottom.value == piece.bottom.value) || (p.top.value == piece.bottom.value && p.bottom.value == piece.top.value)), 1);
    io.to(socket.rooms[socketRoom]).emit("RefreshBoard", {
      board: board,
      pieceIntroduced: piece,
      nextPlayer: playerTurnOrder[nextPlayer % 4]
    });
  });
});

// Creates the turns for the players.. The orders
function CreatePlayerTurnOrder() {

  let firstPlayerToGoPiece = piecesToGive.find(p => p.top.value == 6 && p.bottom.value == 6);
  let firstTeam = firstPlayerToGoPiece.Team;
  let teammateOfFirstPlayerPiece = piecesToGive.find(p => p.Owner != firstPlayerToGoPiece.Owner && p.Team == firstTeam);

  let secondPlayerToGoAfterFirstPlayerPiece = piecesToGive.find(p => p.Team != firstTeam);
  let secondTeam = secondPlayerToGoAfterFirstPlayerPiece.Team;
  let teammateOfSecondPlayerPiece = piecesToGive.find(p => p.Owner != secondPlayerToGoAfterFirstPlayerPiece.Owner && p.Team == secondTeam);

  // Define players turns
  playerTurnOrder[0] = firstPlayerToGoPiece.Owner;
  playerTurnOrder[1] = secondPlayerToGoAfterFirstPlayerPiece.Owner;
  playerTurnOrder[2] = teammateOfFirstPlayerPiece.Owner;
  playerTurnOrder[3] = teammateOfSecondPlayerPiece.Owner;

  // set teams for UX
  teams[firstPlayerToGoPiece.Owner] = firstTeam;
  teams[teammateOfFirstPlayerPiece.Owner] = firstTeam;
  teams[secondPlayerToGoAfterFirstPlayerPiece.Owner] = secondTeam;
  teams[teammateOfSecondPlayerPiece.Owner] = secondTeam;
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
  let teamNumber = 1;
  let teamIncrement = 0;
  for (let i = 0; i < 28; i++) {
    if (i % 7 == 0 && i > 0) {
      clientIndex++;
    }
    if (teamIncrement % 14 == 0 && teamIncrement > 0) {
      teamNumber++;
    }
    teamIncrement++;
    shuffledArray[i].Owner = clients[clientIndex];
    shuffledArray[i].Team = teamNumber;
  }

  piecesToGive = shuffledArray;
  piecesInPlayerHands = piecesToGive;

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
