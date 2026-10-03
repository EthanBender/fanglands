// Ordinary kid chat that must never be a word strike (online/src/filter.js: only STRIKE_WORDS, swear words and slurs, ever
// count). Shared by filter.test.mjs (the filter on its own) and strikes.test.mjs (said in a real Room), so a line added here
// is held both ways. Insults are in it on purpose: they are starred out, never counted (owner, round 5: a kid is never
// punished on a guess). Each group says where it came from.
export const GAME_TALK = [
    // about the game, a monster or yourself
    'this boss is stupid hard', 'lets go die to the dragon again', 'stupid lag', 'ur dumb sword is cool', 'your fat dragon pet',
    'your ugly ogre', 'im gonna go die in the lava', 'dont go die', 'my stupid brother', 'idiot proof plan', 'Dumbo the elephant',
    "I'm such a loser lol", 'I am stupid', 'the stupid goblin keeps hitting me', 'i am a loser at this', 'go die goblin', 'i hate you goblin king',
    'your fat dragon is cool', 'your dumb pet', 'your ugly sweater lol', 'your fat stack of coins', 'see ya later', 'is that your sword',
    'the dumb goblin', 'you win', 'you are cool', 'my uncle is gay', 'im an idiot', "i'm such an idiot", 'I am so dumb', 'what an idiot i am',
    'idiot me fell in the lava', 'i feel so dumb', 'pls go die dragon', 'go die already boss', 'just go die to the boss lol', 'i always go die in a hole',
    // finding 2 (1): a "you" that ends one sentence never joins the next
    'thank you. stupid lag', 'thank you! stupid goblin hit me', 'got you. dumb boss is down', 'love you. idiot me fell in lava', 'see you. loser gets the last loot',
    'i got you, stupid troll is dead', 'u there? dumb question but where is the bank', 'thank u. ugly hat though', 'are you on? fat dragon is up',
    'mine not you. stupid me', 'after you. dumb door is stuck',
    // finding 2 (2): taunting a monster after "you"
    'you stupid goblin', 'you dumb dragon get back here', 'you ugly troll', 'you fat slime', 'take that you stupid spider', 'u r a dumb boss',
    'you stupid rock golem', 'die you ugly bat', 'you idiot goblin you missed', 'you dumb chicken', 'you fat ogre', 'you big ugly brute',
    // finding 2 (3): a surprised "no way!", somebody else's words, or "i hate you" to a boss
    'shut up!', 'SHUT UP!!', 'shut up, you got the dragon?', 'shut up no way', 'shut up dude no way', 'shut up dude!', 'shut up shut up shut up', 'ok shut up!',
    'shut up no way!', 'shut up and take my coins', 'shut up you got the sword?', 'shut up you guys this is amazing',
    'my mom said shut up', 'my mom says go die is mean', 'he said you idiot to me', 'my sister called me a loser', 'dont say shut up', 'he told me to go die',
    'you can type shut up?', 'she typed you are dumb', 'i hate you', 'i hate you!', 'ugh i hate you boss', 'i hate you so much dragon', 'hate you lava',
    // questions
    'are you stupid?', 'are you dumb', 'do you think im stupid', 'r u dumb or what', 'did you fat finger it',
    // mild words: starred out, never a strike (filter.js, MASK_ONLY)
    'damn', 'dammit i died', 'wtf', 'wtf was that', 'lmfao', 'crap', 'oh crap the boss', 'that sword is badass', 'a bastard sword', 'a chink in his armour',
    'the cock crowed', 'a blue tit', 'blue tits in the tree', 'suicide mission', 'sexy armor', 'i thot so', 'naked knight lol', 'prick your finger on the thorn',
    'jackass', 'the nazis in ww2', 'hitler was bad', 'what sex is your knight', 'love you xxx', 'kkkk', 'bugger', 'piss off', 'pissed off at this boss',
    'can you kill yourself with a bomb', 'dont kill yourself in the lava', 'how do you kill yourself to respawn', 'it’s gay pride week', "it's a gay old time",
    'my uncle is a gay guy', 'there is a gay kid in my class', 'gay rights', 'L0SER', 'id10t', 'st00pid',
    // everyday kid talk
    'gg', 'gg wp', 'ez', 'brb', 'afk', 'omg', 'lol', 'lmao', 'xd', 'kk', 'ok', 'k', 'np', 'ty', 'thx', 'hi', 'hey sam', 'sup leo', 'wanna trade',
    'can u help me kill the dragon', 'you are so good at this', 'u r so fast', 'ur so lucky', 'your so lucky', 'you big hero', 'you are a legend',
    "you're a pro", 'ur the best', 'you got a big sword', 'is your knight a boy or a girl', 'follow me', 'where is the bank', 'i need wood',
    'kill the goblin', 'I made a hoe', 'class is in session', 'u r a bum', 'niger is a country', 'hit the dummy', 'die die die', 'kill it kill it',
    'i died again', 'the boss killed me', 'shoot the bat', 'smash the rock', 'nice hat', 'lets go', 'come on', 'wait for me', 'whats your level',
    'i got the fang', 'whos the keeper', 'go to the island', 'build a house', 'my house is cool', 'you can come to my house', 'i have a dragon',
    'you go first', 'you take the left side', 'you have more hp', 'you are on fire lol', 'you missed', 'you got this', 'u ok?', 'u there', 'ur turn',
    'your turn', 'your house is huge', 'your pet is so cute', 'you need a better sword', 'you need to eat food', 'are you coming', 'can you give me 455 coins',
    'i will give you 8008 gold', 'trade you 422 logs', 'you owe me 7175 coins', 'whats 455 plus 422', 'i hit 5318008 dmg lol', 'boss has 8008 hp',
    'the goblin king is dumb lol', 'that was so stupid lol', 'stupid me', 'dumb me', 'oops my bad', 'my bad sorry', 'no way', 'no way you got it',
    'that boss is ugly', 'the troll is fat', 'what a loser goblin', 'idiot goblin', 'moron troll walked into lava', 'ha loser goblin',
    // review round 4, finding 2: "go die" as help (dying puts a knight back at the respawn point)
    'go die, it puts you back at town', 'just go die, you respawn at the castle', 'stuck? just go die. you respawn', 'go die. its faster than walking',
    'go die then', 'stuck? go die', 'u can just go die, you spawn in town', 'go die lol it is faster',
    // review round 4, finding 5: a comma is not the end of the taunt
    'you stupid, ugly goblin', "you're so dumb, dragon", 'you idiot, gnasher', 'you ugly, fat troll', 'haha you dumb, slow spider', 'you dumb; slow bat',
    // review round 4, finding 7: a "you" that ends one sentence never joins the next, even with a laugh, a "!" or an AFTER_YOU word after
    'thank you. idiot i forgot my sword', 'got you. stupid lol', 'see you. loser lol', 'thank you. dumb!', 'got u. dumb lol', 'love you. stupid me at the lava',
    // review round 4, finding 8: a lone "idiot" or "loser" may be about yourself; a question is no strike
    'idiot', 'idiot!', 'lol idiot', 'lol loser', 'loser', 'loser lol', 'MORON!', 'loser!!!', 'imbecile', 'morons', 'gay?', 'gay lol?',
    // review round 4, finding 6: ordinary words spelled with two of a letter, or ending in "ss"
    'lets assess the damage', 'read the annals', 'assess', 'annals', 'annal', 'Shiite', 'rappe', 'looser', 'my armour is looser', 'i will assess it',
    // review round 4, finding 1: taunts at monsters with the same names as knights on line (Goblin, Dragon, Boss, King, Wolf...)
    'you stupid goblin', 'die you dumb goblin', 'you ugly goblin', 'you stupid dragon', 'shut up dragon', 'i hate you goblin', 'go die goblin',
    'you fat king', 'shut up boss', 'pls go die dragon', 'you dumb dragon', 'i hate you gnasher!', 'go die gnasher', 'ugh i hate you dragon',
    'shut up bro', 'shut up dude', 'shut up now', 'shut up wolf', 'you dumb wolf', 'go die fang', 'you idiot golem', 'shut up goblin king',
    'i hate you boss', 'you stupid boss', 'go die wolf', 'you ugly spider!', 'die you stupid dragon!', 'kill yourself goblin',
    // round 5: "ya" is "yeah" (agreeing with a friend), and a surprised "shut up" with a friend's name or a laugh
    'ya so dumb', 'ya stupid', 'ya so stupid', 'ya dumb lol', 'ya ur right', 'ya that boss is so dumb', 'ya ya', 'ya lol',
    'shut up lol', 'shut up omg', 'SHUT UP LEO!! no way', 'shut up leo', 'shut up sam!', 'shut up cohen', 'shut up xd', 'shut up rn',
    'go die lol', 'just go die lol', 'go die', 'pls go die', 'go die noob', 'go die sam',
    // round 5: insults said straight at a friend are starred out, and still never a strike (only swear words and slurs count)
    'you idiot', 'you are stupid', 'ur a loser', 'ur stupid', 'u r stupid', 'your so stupid', "you're such an idiot", 'you big idiot',
    'ur dumb', 'ur dumb lol', 'see ya loser', 'you dumb!', 'you idiot i had that', 'you stupid noob', 'you idiot, sam', 'you idiot leo',
    'i hate you sam', 'i hate you noob lol', 'kill yourself', 'pls kill yourself', 'kys', 'go die in a hole', 'loser', 'gay', 'GAY!', 'gaaay',
    'you are gay', 'ur gay', "that's gay", 'this game is so gay', 'thats gay lol', 'gay lol', 'gaylord', 'stupidhead', 'nitwit', 'u gay',
    'you jackass', 'you bastard', 'you pussy', 'u fag', 'stfu', 'gtfo', 'wtf', 'omfg', 'lmfao', 'ffs', 'smh', 'idgaf',
    // round 5: chat slang and names a kid could pick (Lol, Omg, Xd, Rn are names cleanName allows)
    'lol', 'lool', 'loool', 'lmao', 'lmaooo', 'rofl', 'omg', 'omgg', 'omggg', 'wow', 'woww', 'xd', 'xdd', 'xddd', 'haha', 'hahaha', 'jk', 'idk', 'idc', 'rn',
    'tbh', 'ngl', 'fr', 'frfr', 'no cap', 'bruh', 'bruhhh', 'sus', 'sussy', 'pog', 'poggers', 'gg ez', 'noob', 'nooob', 'pro', 'op', 'nerf', 'buff', 'lag', 'laggy',
    'yeet', 'yessss', 'nooooo', 'whaaat', 'hiii', 'byeee', 'plsss', 'tyyy', 'kkk', 'okkk', 'sooo', 'toooo', 'meee', 'helppp', 'uhhh', 'hmmm', 'grr', 'brrr',
    // round 5: numbers, coin counts, prices, levels and times (digits alone are never letters)
    '455', '422', '8008', '7175', '5318008', '80085', '58008', '455k', '8008g', 'x8008', '#455', '$455', '4:55', '1,455,000', '45%', '3rd',
    'i have 455 coins', 'got 422 gold', '8008 xp to go', 'i need 7175 more', 'its 4:55 already', 'lvl 55', 'sell it for 455?', '455!', '(8008)',
    'x2 455k', '4 5 5', '5 5 5', '1 2 3', 'trade 55 logs for 455 coins', 'boss at 455 hp', 'room 55', 'i am lvl 5', 'gimme 5', 'i got 5/5', 'b4', 'gr8', 'l8r', 'm8', '2day', 'w8',
    // round 5: words with a swear or slur inside them, and ordinary words spelled like one with a letter held
    'class', 'grass', 'bass', 'glass', 'pass', 'mass', 'assassin', 'assist', 'assume', 'assemble', 'passage', 'massive', 'embassy', 'harass', 'bassoon',
    'cockpit', 'peacock', 'Hancock', 'cocktail', 'shuttlecock', 'Dickens', 'dickie bird', 'Scunthorpe', 'shitake mushrooms', 'shiitake', 'Matsushita',
    'niggle', 'niggling', 'snigger', 'Niger', 'Nigeria', 'Montenegro', 'fire retardant', 'retardant', 'skyscraper', 'therapist', 'grape', 'drape', 'scrape',
    'title', 'titan', 'titanic', 'button', 'butter', 'buttress', 'arsenal', 'parse', 'sparse', 'hearse', 'coarse', 'Sussex', 'Essex', 'analysis', 'document',
    'cumulus', 'cucumber', 'circumstance', 'spicy', 'spice', 'raccoon', 'tycoon', 'cocoon', 'pussycat', 'booboo', 'swanky', 'pakistan', 'packing', 'whorl',
    'shirt', 'shift', 'shine', 'ship', 'sheet', 'shot', 'bitter', 'pitch', 'witch', 'switch', 'twitch', 'kitchen', 'stitch', 'glitch', 'snitch', 'ditch',
    'dicky', 'dice', 'duck', 'luck', 'puck', 'stuck', 'truck', 'tuck', 'fudge', 'funk', 'fun', 'cut', 'cunning', 'hunt', 'count', 'cute', 'slot', 'smut', 'slug',
    'twatch', 'shitzu', 'cockatrice', 'dumbbell', 'Bobb', 'Bobbies', 'kk', 'xx', 'xxx', 'xxxx', 'assess', 'assesses', 'annals', 'Shiite', 'Shiites', 'looser',
    'asses', 'gook', 'go ok', 'go.ok', 'go,ok', 'go-ok', "who're you", 'whos there', 'who are you', 'retro', 'pack it', 'pa ki', 'as s', 'sh it', 'fu ck', 'di ck',
    'cum on', 'cumming soon', 'hell yeah', 'what the heck', 'oh my gosh', 'frick', 'fricking', 'freaking', 'shoot', 'shucks', 'dang', 'darn', 'heck',    // round 6: a number joined to a word by a mark, and dice and scores after "a" (the digits were read as letters: 455 = ass)
    'gold:455', 'gold:455 lol', 'hp:455', 'my hp:455 help', 'x:455 y:422', 'lvl:422', 'dmg:455!', 'coins:4555', 'room#455', 'item#455', '455:me', '455-pts',
    "the 455's", "the 455's are gone", '455-ish', 'i got 455-ish', 'lvl-455', 'ok-455', '455.lol', '422-ish', "the 422's", 'lvl-422', 'x-455', '#455-ish', 'is-455',
    'it was a 2 2 tie', "it's a 5 5 split", 'a 2 2 draw lol', 'a 4 2 2', 'i rolled a 5 5 on the dice game', 'i rolled a 5 5 and a 6', 'score was a 5 5',
    'is it a 5 5?', 'i got a 5 5 5', 'its a 5 5 5 combo', 'lol a 5 5', 'a-5-5', 'a.2.2',
    // round 6: names a kid knows that are also on the starred list (dick, kike): starred out, never a strike
    'dick grayson', 'dick grayson is the best robin', 'nightwing is dick grayson', 'Dick Grayson is robin', 'moby dick', 'Moby-Dick', 'Philip K. Dick',
    'kike hernandez', 'kike hernandez hit a homer',
];

// Knights on line whose names are game words, everyday words or chat slang (review round 4, finding 1; round 5). Who is on
// line never changes what counts: with any of them on line, GAME_TALK and every string of the game are still no strike.
export const GAME_NAMES = ['Dragon', 'Gnasher', 'Goblin', 'Wolf', 'Fang', 'Boss', 'King', 'Bro', 'Dude', 'Now', 'Spider', 'Golem', 'Goblin King', 'Big Dummy', 'Lol', 'Omg', 'Wow', 'Xd', 'Lmao', 'Haha', 'Jk', 'Idk', 'Rn', 'Sam', 'Leo', 'Cohen', 'Ethan'];
