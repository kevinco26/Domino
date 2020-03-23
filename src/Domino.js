import React, { Component } from 'react';
import axios from 'axios';
import './App.css';

class Domino extends Component {
    constructor() {
        super();
        this.state = {
            pieces: [],
            board: [],
            currentPlayingPiece: {},
            nextPlayer: null,
            roundOver: true,
            roundNumber: 0
        };
    }
    componentDidMount() {
        // whenever we receive the refresh board event from server, update the local's board state
        this.props.socket.on("RefreshBoard", (data) => {
            console.log("Board was refreshed. State of the board is:")
            console.log(data.board);
            console.log("Piece that got introduced was:");
            console.log(data.pieceIntroduced);

            this.removeUserPiece(data.pieceIntroduced);
            this.setState({ board: data.board, nextPlayer: data.nextPlayer });
        });

        this.props.socket.on("BeginNewRound", (data) => {
            this.setState({ board: data.board, nextPlayer: data.playerToStart, pieces: [], currentPlayingPiece: {}, roundOver: false, roundNumber: data.roundNumber });

        });

        this.props.socket.on("RoundOver", (data) => {
            let losingTeamScore = data.winningTeam == 1 ? data.scores["team2"] : data.scores["team1"];
            if (this.props.teams[this.props.socket.id] == data.winningTeam) {
                alert("You and your teammate won this round! your oppoinent's score:" + losingTeamScore);
            }
            else {
                alert("You and your teammate lost this round! your score:" + losingTeamScore);
            }

            // flag round is over.
            this.setState({ roundOver: true });
        });
    }

    removeUserPiece(piece) {
        if (piece == null) {
            return;
        }
        var index = this.state.pieces.findIndex(p => (p.top.value == piece.top.value && p.bottom.value == piece.bottom.value) || (p.top.value == piece.bottom.value && p.bottom.value == piece.top.value));
        if (index !== -1) {
            this.state.pieces.splice(index, 1);
            console.log(piece);
            console.log("piece removed")
        }
        if (this.state.pieces.length === 0) {
            this.endRound();
        }
    }
    render() {
        return (
            <div className="App">
                Hello and welcome to the Domino Board.
                You are in team: {this.props.teams[this.props.socket.id]}
                {this.props.socket.id == this.state.nextPlayer && <p>It's your turn</p>}
                <br></br>
                {this.state.pieces.length == 0 && <button onClick={this.getPieces}>Click to get pieces</button>}
                <br></br>
                {<button onClick={this.noAvailableMoves}>Click to pass (if no available moves)</button>}
                <br></br>
                Your pieces are: {
                    this.state.pieces.map((piece) => <li><button onClick={this.playPiece.bind(this, piece)}>{piece.top.value} | {piece.bottom.value}</button></li>)}

                <div style={{ marginTop: "50px" }}>
                    The board: <br></br> <br></br>
                    {
                        this.state.board.map((piece) => <button style={{ marginRight: "1px", marginLeft: "1px" }} disabled={true}><button onClick={this.playPieceOnBoard.bind(this, piece.top, "left")}>{piece.top.value}</button> | <button onClick={this.playPieceOnBoard.bind(this, piece.bottom, "right")}>{piece.bottom.value}</button></button>)
                    }
                </div>
                <div style={{ marginTop: "50px" }}>
                    {this.state.roundOver && <button onClick={this.readyUp}>Click to ready up for next round</button>}
                </div>
            </div >
        );
    }

    readyUp = () => {
        // ready up next round
        this.props.socket.emit("ReadyUp", this.props.socket.id);
    }

    getPieces = () => {
        axios.get(`/pieces?clientId=${this.props.socket.id}`).then(response => {
            this.setState({ pieces: response.data });
        })
    }

    endRound = () => {
        this.props.socket.emit("endRound", this.props.teams[this.props.socket.id]);
    }

    noAvailableMoves = () => {
        // check if the player really can't pass... 
        // also check if its the player's turn.. maybe we can put this button only if its the player's turn
        this.props.socket.emit("Pass")
    }

    playPiece = (piece) => {
        // we have the playerToStart because the first round/piece does not get emmitted from the server rather passed from the App.js component
        // so we must have this playertostart variable hanging around here.
        if (this.state.nextPlayer == null && this.props.playerToStart != this.props.socket.id) {
            console.log("Cannot play");
            this.setState({ currentPlayingPiece: null });
            return;
        }
        else if (this.state.nextPlayer != null && this.state.nextPlayer != this.props.socket.id) {
            console.log("Cannot play");
            this.setState({ currentPlayingPiece: null });
            return;
        }
        // if the board is 0 and the piece is 6,6 in the first round, allow it.
        // in subsequent rounds, the nextplayer wont be null. meaning we will always check if its the player's turn.
        if (this.state.board.length == 0) {
            if (this.state.roundNumber == 0 && piece.top.value != 6 && piece.bottom.value != 6) {
                console.log("Cannot play if its not 6-6 on the first round!")
            }
            else {
                this.props.socket.emit("PlayPiece", piece, null);
            }
        }
        else {
            console.log("You want to play piece.. Please choose a side... if possible");
            console.log(piece);
            this.setState({ currentPlayingPiece: piece });
        }
    }

    // halfPiece since we are only passing either the top or the bottom and verifying that the half piece the user clicked is open
    playPieceOnBoard = (halfPiece, direction) => {
        halfPiece.direction = direction;
        console.log("direction:" + direction);
        console.log("halfpiece (you clicked) on: ")
        console.log(halfPiece);
        if (!halfPiece.open) {
            console.log("invalid place to put a piece as the half piece is not open");
            this.setState({ currentPlayingPiece: null });
            return;
        }
        else {

            if (this.state.currentPlayingPiece != null &&
                (this.state.currentPlayingPiece.top.value == halfPiece.value || this.state.currentPlayingPiece.bottom.value == halfPiece.value)) {
                console.log("You are allowed to play!");
                console.log("state current playing piece:")
                console.log(this.state.currentPlayingPiece);
                this.props.socket.emit("PlayPiece", this.state.currentPlayingPiece, halfPiece)
                this.setState({ currentPlayingPiece: null });
            }
        }
    }
}

export default Domino;
