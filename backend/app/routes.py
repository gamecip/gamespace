import re
import os
import json

from flask import Flask, render_template, request

# JOR: I THINK THE COMMENTED LINE NEEDS TO BE USED FOR ACTUAL DEPLOYMENT

# app = Flask(__name__, static_url_path='/gamespace/static')
app = Flask(__name__)


@app.route('/gamespace')
def home():
    """Render a GameSpace instance that starts from a random game."""
    # Pass -1 for starting_game_id, which will cause a random game to be selected as the start point
    return render_template('index.html', starting_game_id=-1)


@app.route('/gamespace/start=<starting_game_hashed_id>')
def home_with_specified_start_game(starting_game_hashed_id):
    """Render a GameSpace instance that starts from a specified game."""
    # Try to unhash the hashed game ID
    starting_game_unhashed_id = int(starting_game_hashed_id, 16) / 348290
    if starting_game_unhashed_id in range(0, 11829):
        # A valid ID was passed -- start from the specified game
        return render_template('index.html', starting_game_id=starting_game_unhashed_id)
    else:  # A bogus ID was passed -- start from a random game
        return render_template('index.html', starting_game_id=-1)

@app.route('/gamespace/load_info')
def load_info():
    return json.dumps([fn for fn in os.listdir("./static/model_data") if fn.split(".")[-1] == "json"])



if __name__ == '__main__':
    app.run(debug=False)
else:
    pass


# if not app.debug:
#     import logging
#     file_handler = logging.FileHandler('gamespace.log')
#     file_handler.setLevel(logging.WARNING)
#     app.logger.addHandler(file_handler)
