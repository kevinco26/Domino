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
      if (clients.length > 3) {
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
            io.to(socket.rooms[socketRoom]).emit('BeginDomino', {
              message: "Let's Play! We aare 4 in the room already!"
            });
          }
        });
      }
    });
  });

  socket.on("PlayPiece", (piece, halfPiece) => {
    console.log("received piece:");
    console.log(piece.top + " | " + piece.bottom);

    console.log("Desired to put it on: " + halfPiece);

    // need to figure out how to put it in the right array order maybe...?
    // If starting, push it at the beginning
    if (board.length == 0) {
      piece.top.open = true;
      piece.bottom.open = true;
      board.push(piece);
    }
    // if second piece is going to be played (board has 1 piece)
    else if (board.length == 1) {
      let placeToPutPiece = board.findIndex(boardPiece => (boardPiece.top.open == true && boardPiece.top.value == halfPiece.value)
        || (boardPiece.bottom.open == true && boardPiece.bottom.value == halfPiece.value));
      if (board[0].top.value == halfPiece.value) {
        // we need to put the new piece at the beginning. THe problem here is now if we need to switch top bottom or not.
        // i.e Board has: 4 | 3. I have 0 | 4 so I chose 4(halfPiece). baord.top is halfpiece value so we go in.
        // Now. If my piece 0 | 4 bottom's is == boards top then put it before.
        // if my piece 4 | 0 top's is board's top. then put it before but invert so that we have 0 | 4.

        //   piece.top.open = true;
        //   board[placeToPutPiece].bottom.open = false;
        //   board.push(piece);
        // }
        // else if the piece is at the bottom of the current board. then do the same thing.
        // if my piece 0 | 4 top mtaches board's bottom then just push it.  else swith 4 | 0 then push.
      }
      else if (board[0].bottom.value == halfPiece.value) {

        // piece.top.open = true;
        // board[placeToPutPiece].top.open = false
        // board.splice(0, 0, piece);
      }
    }
    else {
    }
    io.to(socket.rooms[socketRoom]).emit("RefreshBoard", {
      board: board,
      pieceIntroduced: piece
    });
  });
});

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
