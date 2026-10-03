// Ordinary kid game talk that must never be a word strike (online/src/filter.js, "the most important rule"). Shared by
// filter.test.mjs (the filter on its own) and strikes.test.mjs (said in a real Room), so a line added here is held both ways.
// Each group says which review round or finding it came from.
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
];

// Knights on line whose names are game words or everyday words (review round 4, finding 1). With any of them on line,
// GAME_TALK and every string of the game are still no strike.
export const GAME_NAMES = ['Dragon', 'Gnasher', 'Goblin', 'Wolf', 'Fang', 'Boss', 'King', 'Bro', 'Dude', 'Now', 'Spider', 'Golem', 'Goblin King', 'Big Dummy'];
