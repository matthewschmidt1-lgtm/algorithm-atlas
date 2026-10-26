// Algorithms for the kitchen: a bridge for readers who do not feel confident with numbers.
// Three things cooks already do, written out as the step lists they are, each ending at the
// lesson where a computer does the same. No formulas. Every figure here is checked by
// tools/tests.js (suite "kitchen") against the rule it illustrates.

export const kitchenIntro = {
  // on the home page, in two paragraphs
  homeLede: [
    'Think algorithms are all numbers, formulas, and computer code? Think again. You use them every time you cook. A recipe is an algorithm: a set of steps that helps you get from ingredients to something delicious.',
    'Let’s explore three everyday kitchen puzzles and discover the clever ideas behind them. No formulas, no technical jargon—just familiar problems, simple steps, and a new way of seeing the everyday.',
  ],
  eyebrow: 'A gentle start',
  title: 'Algorithms for the kitchen',
  lede: 'An algorithm is a list of steps that solves a problem the same way every time. If you have followed a recipe, you have followed an algorithm. Here are three that cooks use without ever calling them that. There are no formulas on this page, and each one ends at the lesson where a computer does the same thing.',
};

export const kitchen = [
  {
    id: 'spices',
    lesson: 'binary-search',
    alsoLesson: 'linear-search',
    title: 'Finding a jar on a sorted spice rack',
    question: 'Where is the cumin?',
    gist: 'Turn the middle jar. Rule out half the rack. Repeat.',
    setup: 'Your spice rack holds sixteen jars in alphabetical order, with the labels turned to the wall. You can turn one jar at a time to read it.',
    steps: [
      'Turn the jar in the middle of the rack.',
      'If it is the spice you want, stop.',
      'If your spice comes earlier in the alphabet, forget this jar and every jar to its right. If it comes later, forget this jar and every jar to its left.',
      'Turn the middle jar of the ones that are left, and repeat.',
    ],
    point: 'That is the whole algorithm. Every look rules out half of the jars that are left, so sixteen jars never take more than five looks. Turning them one by one from the left could take all sixteen.',
    jars: ['Allspice', 'Basil', 'Cardamom', 'Cinnamon', 'Cloves', 'Cumin', 'Dill', 'Fennel', 'Ginger', 'Mint', 'Nutmeg', 'Oregano', 'Paprika', 'Rosemary', 'Saffron', 'Thyme'],
    limits: 'It only works because the rack is in order. Put one jar back in the wrong place and the search can rule out the half that holds your spice without noticing. A computer follows the same steps through lists with millions of entries: a million entries never need more than 20 looks.',
    computer: 'A computer does exactly this with a sorted list. The method is called binary search.',
  },
  {
    id: 'dinner',
    lesson: 'critical-path',
    title: 'Getting everything to the table at once',
    question: 'When should each dish start?',
    gist: 'Start the longest chain first. Everything else has time to spare.',
    setup: 'Dinner is at 7:00. The roast chicken needs 75 minutes in the oven and then 15 minutes to rest. The potatoes need 15 minutes of peeling and then 45 minutes in the oven. The green beans need 10 minutes in a pan.',
    serveAt: [19, 0],
    dishes: [
      { name: 'Roast chicken', tasks: [{ name: 'in the oven', minutes: 75 }, { name: 'resting', minutes: 15 }] },
      { name: 'Roast potatoes', tasks: [{ name: 'peeling', minutes: 15 }, { name: 'in the oven', minutes: 45 }] },
      { name: 'Green beans', tasks: [{ name: 'in the pan', minutes: 10 }] },
    ],
    steps: [
      'For each dish, add up the steps that have to happen one after another.',
      'Find the longest of these chains. Here it is the chicken: 75 minutes and then 15, which is 90 minutes.',
      'Count back from dinner time. The chicken has to go in at 5:30. No dish can make dinner earlier than its longest chain allows.',
      'Every other dish can start later. The potatoes need 60 minutes, so they can start any time up to 6:00. The beans can wait until 6:50.',
    ],
    point: 'The chain with no spare time is called the critical path. A delay on it makes dinner late. A delay anywhere else is soaked up by the spare time, until the spare time runs out.',
    limits: 'The method assumes you have as many hands and ovens as you need. A real cook cannot peel and baste at the same moment, and two dishes may want the oven at different temperatures. Project planners meet the same limit with people and machines, and deal with it as a separate problem.',
    computer: 'Project managers use the same steps to plan buildings, product launches and events, often with hundreds of tasks. The method is called the critical path method.',
  },
  {
    id: 'dressing',
    lesson: 'gradient-descent',
    title: 'Tasting your way to the right dressing',
    question: 'How much lemon?',
    gist: 'Taste, adjust a little, taste again.',
    setup: 'You are making a salad dressing from oil and lemon juice. No recipe gives the exact amounts for your lemons and your taste. You want it to taste right.',
    steps: [
      'Taste it.',
      'If it is too sharp, add a little oil. If it is too flat, add a little lemon.',
      'The further off it tastes, the bigger the splash. The closer it gets, the smaller.',
      'Taste again, and repeat until you are happy with it.',
    ],
    tastes: [
      { taste: 'Far too sharp', change: 'A big splash of oil' },
      { taste: 'Still a little sharp', change: 'A small splash of oil' },
      { taste: 'Now a touch flat', change: 'A few drops of lemon' },
      { taste: 'Right', change: 'Stop' },
    ],
    point: 'Look at the third taste. The small splash of oil went a little too far, so the next change came back the other way, and smaller again. Going slightly past and correcting is a normal part of the method, not a failure of it.',
    limits: 'A computer measures how wrong it is with an exact number, not a taste, and it may adjust millions of settings at once instead of two. And like a cook, it only feels its way from where it starts. It can settle on a dressing that is good without ever finding a better one that would need a completely different start.',
    computer: 'This is how a machine learning model learns. It makes a guess, measures how wrong the guess is, nudges its settings in the direction that makes it less wrong, and repeats. The method is called gradient descent.',
  },
];

export const kitchenEnd = {
  title: 'What the three have in common',
  text: 'Each one is a short list of steps that anyone can follow, that always comes to an end, and that gives a dependable result. That is all an algorithm is. Every lesson in this atlas is the same kind of thing, written down carefully enough for a computer to follow, and run in front of you so you can watch it work.',
};
