$( document ).ready(function() {
    var bg = ['assets/gifs/flippity.gif', 'assets/gifs/moonwalk.gif', 'assets/gifs/rev.gif', 'assets/gifs/spinz.gif', 'assets/gifs/splitz.gif', 'assets/gifs/pan.gif', 'assets/gifs/spin.gif', 'assets/gifs/tap.gif'],
    selectBG = bg[Math.floor(Math.random() * bg.length)];

    $('body').css('background', 'url(' + selectBG + ')')

    var titleColor = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#800080']
    var selectColor = titleColor[Math.floor(Math.random() * titleColor.length)];
    $('.title').css('color', selectColor)
    $('.buttoncolor').css('background-color', selectColor)

document.getElementById("change").addEventListener("click", function() {
            location.reload();
        });

        var musicArray = ["assets/audio/cold.wav", "assets/audio/funky.wav", "assets/audio/give.wav", "assets/audio/hustle.wav", "assets/audio/proud.wav", "assets/audio/csl1.wav", "assets/audio/csl2.wav", "assets/audio/dead.wav", "assets/audio/president.wav", "assets/audio/sp4.wav"]
        var musicChoice = musicArray[Math.floor(Math.random() * musicArray.length)];

        music(musicChoice)

        function music(musicChoice) {
            loopify(musicChoice, ready);

            function ready(err, loop) {
                if (err) {
                    console.warn(err);
                }
                loop.play();
                // document.getElementById("stop").addEventListener("click", function() {
                //     loop.stop();
                // });
            }
        }
});

