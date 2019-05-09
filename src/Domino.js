import React, { Component } from 'react';
import axios from 'axios';
import './App.css';

class Domino extends Component {
    constructor() {
        super();
        this.state = {
            pieces: [],
            board: [],
            currentPlayingPiece: {}
            //board: [{ top: { value: 6, open: true }, bottom: { value: 6, open: false } }, { top: { value: 6, open: false }, bottom: { value: 2, open: true } }],
        };
    }
    componentDidMount() {
        // whenever we receive the refresh board event from server, update the local's board state
        this.props.socket.on("RefreshBoard", (data) => {
            this.removeUserPiece(data.pieceIntroduced);
            this.setState({ board: data.board });
        });
    }

    removeUserPiece(piece) {
        var index = this.state.pieces.findIndex(p => p.top.value == piece.top.value && p.bottom.value == piece.bottom.value);
        if (index !== -1) {
            this.state.pieces.splice(index, 1);
        }
    }
    render() {
        return (
            <div className="App">
                Hello and welcome to the Domino Board
                <br></br>
                {this.state.pieces.length == 0 && <button onClick={this.getPieces}>Click to get pieces</button>}
                <br></br>
                Your pieces are: {
                    this.state.pieces.map((piece) => <li><button onClick={this.playPiece.bind(this, piece)}>{piece.top.value} | {piece.bottom.value}</button></li>)}

                <div style={{ marginTop: "50px" }}>
                    The board: <br></br> <br></br>
                    {
                        this.state.board.map((piece) => <button style={{ marginRight: "1px", marginLeft: "1px" }} disabled={true}><button onClick={this.playPieceOnBoard.bind(this, piece.top)}>{piece.top.value}</button> | <button onClick={this.playPieceOnBoard.bind(this, piece.bottom)}>{piece.bottom.value}</button></button>)
                    }
                </div>
            </div >
        );
    }

    getPieces = () => {
        axios.get(`http://127.0.0.1:8080/pieces?clientId=${this.props.socket.id}`).then(response => {
            this.setState({ pieces: response.data });
        })
    }

    playPiece = (piece) => {
        console.log("board:");
        console.log(this.state.board);

        console.log(piece);
        // if the board is 0 and the piece is 6,6, then allow it.
        if (this.state.board.length == 0) {
            if (piece.top.value == 6 && piece.bottom.value == 6) {
                this.props.socket.emit("PlayPiece", piece, null);
            }
        }
        else {
            console.log("You want to play piece: ");
            console.log(piece);
            console.log("Please choose a side... if possible");
            this.setState({ currentPlayingPiece: piece });
        }
    }

    // halfPiece since we are only passing either the top or the bottom and verifying that the half piece the user clicked is open
    playPieceOnBoard = (halfPiece) => {
        console.log("hello");
        if (!halfPiece.open) {
            console.log("invalid place to put a piece");
        }
        else {
            console.log(halfPiece);
            if (this.state.currentPlayingPiece.top) {
                console.log(this.state.currentPlayingPiece);
                if (this.state.currentPlayingPiece.top.value == halfPiece.value || this.state.currentPlayingPiece.bottom.value == halfPiece.value) {
                    console.log("Emitting event...");
                    this.props.socket.emit("PlayPiece", this.state.currentPlayingPiece, halfPiece)
                }
            }
        }
    }
}

export default Domino;
