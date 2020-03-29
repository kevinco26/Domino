





let board = shuffle(ConstructInitialPiecesArray());

//let board = ConstructInitialPiecesArray();

console.log(board);

//let board2 = {board[0], board[1] };

//consolae.log(board2);
let temp = partidaTrancated(board);

console.log(temp);


function ConstructInitialPiecesArray() {
  let piecesDealt = [];
  let j = 0;
  let k = 0;
  for (let i = 0; i < 20; i++) {
    if (k == 7) {
      j++;
      k = j
    }
    let dominoPiece = { top: { value: j }, bottom: { value: k } };
    //console.log(dominoPiece);
    piecesDealt.push(dominoPiece);
    k++;
  }
  return piecesDealt;
}


//Function that returns true if the game is trancated
function partidaTrancated(board){
  //Variables para agarrar las esquinas abiert
  let esquinaIzq = board[0].top.value
  let esquinaDer = board[board.length-1].bottom.value

  //variable que cuenta piezas del mismo numero
  let temp =0
  if(esquinaIzq==esquinaDer){
    board.forEach(piece => {
      if(piece.top.value==esquinaIzq || piece.bottom.value==esquinaIzq){
        temp++;
      }


    });

    console.log( "Esto es temp " +temp);
    if(temp ==7){
    	console.log ("se Tranco La partida");
      	return true;
    }
    else{
    	return false;
    }
  }
  else{
    console.log ("No esta trancada");
    return false;
  }

}



function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}