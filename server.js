// Setting up variables

var express = require('express');
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

var roomToPropertiesMap = {}; // new Map();
const path = require('path')

// Serve static files from the React frontend app
expressApp.use(express.static(path.join(__dirname, '/build')))

// Anything that doesn't match the above, send back index.html
expressApp.get('/', (req, res) => {
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
  let socketId = request.query["clientId"];
  let rooms = io.sockets.sockets[socketId].rooms;
  let room = Object.keys(rooms)[1];
  response.send(roomToPropertiesMap[room].piecesToGive.filter(piece => piece.Owner == socketId));
});

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
          // If the clients before the new socket joined were 3 - then max number reached, begin playing.
          if (clients.length == 3) {
            // ready to begin domino. Shuffle and assign pieces to players.
            let updatedClients = clients;
            updatedClients.push(socket.id);

            roomToPropertiesMap[room] = {
              board: [],
              piecesInPlayerHands: [],
              piecesToGive: [],
              playerTurnOrder: [],
              nextPlayer: 0,
              nextClientToStartRound: 0,
              roundNumber: 0,
              listOfReadyUpSockets: {},
              teams: {}
            }

            CreateDominoPieces(updatedClients, room);
            CreatePlayerTurnOrder(room);
            console.log(roomToPropertiesMap[room].teams);
            io.to(socket.rooms[room]).emit('BeginDomino', {
              teams: roomToPropertiesMap[room].teams,
              playerToStart: roomToPropertiesMap[room].playerTurnOrder[0]
            });
          }
        });
      }
    });
  });

  socket.on("Pass", () => {
    // For now, one socket per room. Object.keys(socket.rooms) -> [socketId, room]
    let room = Object.keys(socket.rooms)[1];
    roomToPropertiesMap[room].nextPlayer++;
    io.to(socket.rooms[room]).emit("RefreshBoard", {
      board: roomToPropertiesMap[room].board,
      pieceIntroduced: null,
      nextPlayer: roomToPropertiesMap[room].playerTurnOrder[roomToPropertiesMap[room].nextPlayer % 4]
    });
  });

  socket.on("ReadyUp", (socketId) => {
    let room = Object.keys(socket.rooms)[1];
    if (roomToPropertiesMap[room].listOfReadyUpSockets[socketId]) {
      console.log("already readied up")
    }
    else {
      roomToPropertiesMap[room].listOfReadyUpSockets[socketId] = true
      let arrayClients = Object.keys(roomToPropertiesMap[room].listOfReadyUpSockets);
      if (arrayClients.length == 4) {

        // resetting states
        roomToPropertiesMap[room] = {
          board: [],
          piecesInPlayerHands: [],
          piecesToGive: [],
          nextPlayer: 0,
          listOfReadyUpSockets: {},
          nextClientToStartRound: roomToPropertiesMap[room].nextClientToStartRound + 1,
          roundNumber: roomToPropertiesMap[room].roundNumber + 1,
          teams: roomToPropertiesMap[room].teams,
          playerTurnOrder: roomToPropertiesMap[room].playerTurnOrder
        }

        console.log(roomToPropertiesMap[room]);

        CreateDominoPieces(arrayClients, room);
        io.to(socket.rooms[room]).emit("BeginNewRound", {
          board: roomToPropertiesMap[room].board,
          playerToStart: roomToPropertiesMap[room].playerTurnOrder[roomToPropertiesMap[room].nextClientToStartRound % 4],
          roundNumber: roomToPropertiesMap[room].roundNumber
        });
      }
    }
  });

  socket.on("endRound", (winningTeam) => {
    let room = Object.keys(socket.rooms)[1];
    let finalScores = GetScores(room);

    // Scoring works this way: First team to 100 loses.
    // If team 1 won then we sum up the pieces of team2 and give that sum(score) to them.
    // Similarily, if team 2 won then we sum up the pieces of team1 and give that sum to them.
    // If no team won (this api will have winningTeam = 0 or null, TBD) then return the scores of both teams as we need to add them to both
    // We are not storing scores yet.. this is for the ux para que por ahora nosotros lo anotemos

    if (winningTeam == 1) {
      finalScores["team1"] = 0;
    }
    if (winningTeam == 2) {
      finalScores["team2"] = 0;
    }

    io.to(socket.rooms[room]).emit("RoundOver", {
      scores: finalScores,
      winningTeam: winningTeam
    });
  });

  // halfPiece is the part of the piece that we are playing with.
  // si tenemos un 5|4, halfpiece nos va a decir si queremos jugar el 5 o el 4
  socket.on("PlayPiece", (piece, halfPiece) => {
    let room = Object.keys(socket.rooms)[1];
    console.log("received piece:");
    console.log(piece.top.value + "|" + piece.bottom.value);

    // first time, halfPiece is null
    if (halfPiece != null)
      console.log("Desired to put it on: " + halfPiece.value);

    // need to figure out how to put it in the right array order maybe...?
    // If starting, push it at the beginning
    if (roomToPropertiesMap[room].board.length == 0) {
      piece.top.open = true;
      piece.bottom.open = true;
      roomToPropertiesMap[room].board.push(piece);
    }
    // if second piece is going to be played (board has 1 piece)
    else {
      if (piece.top.value == halfPiece.value) {
        console.log(halfPiece.direction)
        // this case is 6 | 6 on the board and i have 6 | 1
        if (halfPiece.direction == "right") {
          // I clicked on the left so I just need to put the 1 | 6 at the left of the board.
          // I would have 1 | 6 - 6|6.. now the opens are 1 and 6... will figure that out later
          roomToPropertiesMap[room].board.push(piece);
        }
        else {
          // I clicked on the right. so I need to invert the 1 |  6 so that its 6| 6 - 6 | 1
          console.log("invert");
          var tempTop = piece.top;
          piece.top = piece.bottom;
          piece.bottom = tempTop;
          roomToPropertiesMap[room].board.splice(0, 0, piece);
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
          roomToPropertiesMap[room].board.push(piece);
        }
        else {
          // I clicked on the left so I just need to put the 1 | 6 at the left of the board.
          // I would have 1 | 6 - 6|6.. now the opens are 1 and 6... will figure that out later
          roomToPropertiesMap[room].board.splice(0, 0, piece);
        }
      }
    }

    roomToPropertiesMap[room].nextPlayer++;
    SetOpenEndsOnBoard(roomToPropertiesMap[room].board);

    // Updaet the current pieces that are in the player's hands
    roomToPropertiesMap[room].piecesInPlayerHands.splice(roomToPropertiesMap[room].piecesInPlayerHands.findIndex(p => (p.top.value == piece.top.value && p.bottom.value == piece.bottom.value) || (p.top.value == piece.bottom.value && p.bottom.value == piece.top.value)), 1);
    io.to(socket.rooms[room]).emit("RefreshBoard", {
      board: roomToPropertiesMap[room].board,
      pieceIntroduced: piece,
      nextPlayer: roomToPropertiesMap[room].playerTurnOrder[roomToPropertiesMap[room].nextPlayer % 4]
    });
  });
});

function GetScores(room) {
  let scoreTeam1 = 0;
  let scoreTeam2 = 0;
  roomToPropertiesMap[room].piecesInPlayerHands.forEach((p) => {
    if (p.Team == 1) {
      scoreTeam1 += p.top.value + p.bottom.value;
    }
    else {
      scoreTeam2 += p.top.value + p.bottom.value;
    }
  });
  return { "team1": scoreTeam1, "team2": scoreTeam2 };
}

// Creates the turns for the players.. The orders
function CreatePlayerTurnOrder(room) {

  let firstPlayerToGoPiece = roomToPropertiesMap[room].piecesToGive.find(p => p.top.value == 6 && p.bottom.value == 6);
  let firstTeam = firstPlayerToGoPiece.Team;
  let teammateOfFirstPlayerPiece = roomToPropertiesMap[room].piecesToGive.find(p => p.Owner != firstPlayerToGoPiece.Owner && p.Team == firstTeam);

  let secondPlayerToGoAfterFirstPlayerPiece = roomToPropertiesMap[room].piecesToGive.find(p => p.Team != firstTeam);
  let secondTeam = secondPlayerToGoAfterFirstPlayerPiece.Team;
  let teammateOfSecondPlayerPiece = roomToPropertiesMap[room].piecesToGive.find(p => p.Owner != secondPlayerToGoAfterFirstPlayerPiece.Owner && p.Team == secondTeam);

  // Define players turns
  roomToPropertiesMap[room].playerTurnOrder[0] = firstPlayerToGoPiece.Owner;
  roomToPropertiesMap[room].playerTurnOrder[1] = secondPlayerToGoAfterFirstPlayerPiece.Owner;
  roomToPropertiesMap[room].playerTurnOrder[2] = teammateOfFirstPlayerPiece.Owner;
  roomToPropertiesMap[room].playerTurnOrder[3] = teammateOfSecondPlayerPiece.Owner;

  // set teams for UX
  roomToPropertiesMap[room].teams[firstPlayerToGoPiece.Owner] = firstTeam;
  roomToPropertiesMap[room].teams[teammateOfFirstPlayerPiece.Owner] = firstTeam;
  roomToPropertiesMap[room].teams[secondPlayerToGoAfterFirstPlayerPiece.Owner] = secondTeam;
  roomToPropertiesMap[room].teams[teammateOfSecondPlayerPiece.Owner] = secondTeam;
}

function SetOpenEndsOnBoard(board) {
  board.forEach(piece => {
    piece.top.open = false;
    piece.bottom.open = false;
  });
  board[0].top.open = true;
  board[board.length - 1].bottom.open = true;

}
function CreateDominoPieces(clients, room) {
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

  roomToPropertiesMap[room].piecesToGive = shuffledArray;
  roomToPropertiesMap[room].piecesInPlayerHands = shuffledArray;

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
