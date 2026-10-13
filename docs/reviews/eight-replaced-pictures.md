# The eight replaced pictures

These eight lessons get a new "A picture to hold on to", with a new title. Nothing here is on the site yet. Each entry shows what is there now and what is proposed.


---

## Insertion Sort

### Now: Sorting a hand of cards

You hold a few cards in your left hand, already in order. You pick up one more card with your right hand, look along the held cards from the right until you find one that is not larger, and slide the new card in just after it. Your left hand is in order again, with one more card. Repeat until the table is empty.

**Where the picture stops.** With real cards, opening a gap is a single motion of the fingers. In a list stored in a computer, there is no free space between items: every larger value has to be copied one place to the right, one at a time, and that copying is where most of the time goes. A person also finds the place at a glance, while the algorithm compares one card after another.

### Proposed: One card going into a sorted hand

Look closely at a single card going in. You hold a few cards in your left hand, already in order, and pick up one more. You look along the held cards from the right, largest first, and stop at the first one that is not larger than the new card. The new card slides in just after it. If the new card is larger than everything you hold, one look settles it. If it is the smallest, you look at every card in your hand.

**Where the picture stops.** With real cards, opening a gap is a single motion of the fingers. In a list stored in a computer, there is no free space between items: every larger value has to be copied one place to the right, one at a time, and that copying is where most of the time goes. A real card player also finds the place at a glance. The algorithm has no glance and compares one card after another.


---

## Merge Sort

### Now: Two sorted stacks of exam papers

Two teachers each hold a stack of exam papers sorted by student name. To combine them, they look at the top paper of each stack, move whichever name comes first onto a new stack, and repeat. Nobody ever looks below the top of a stack, and the new stack comes out fully sorted. If the original stacks were not sorted, each teacher could split theirs in two, hand the halves to helpers, and merge what comes back.

**Where the picture stops.** The desk in this picture has room for a third stack. A computer has to set that room aside: merge sort needs spare memory as large as the list it is sorting. The helpers in the picture also work at the same time, while the algorithm on this page finishes one half completely before it starts the other. And the picture stops at a few helpers, where the algorithm keeps splitting all the way down to single papers.

### Proposed: A stack of exam papers and two helpers

A teacher has a tall stack of exam papers to sort by student name. The teacher splits the stack in two and hands each half to a helper with one request: bring it back sorted. When the two sorted stacks come back, combining them is easy. Look at the top paper of each stack, move whichever name comes first onto a new stack, and repeat. Nobody ever looks below the top of a stack. Each helper does the same with their own half: split it, hand the halves on, and merge what comes back. The handing-on stops when someone is given a single paper, which is already sorted.

**Where the picture stops.** The desk in this picture has room for a third stack. A computer has to set that room aside: merge sort needs spare memory as large as the list it is sorting. The helpers in the picture also work at the same time, while the algorithm on this page finishes one half completely before it starts the other.


---

## A* Search

### Now: Walking toward a landmark you can see

You are crossing an unfamiliar town toward a tower visible above the rooftops. The straight-line distance to the tower is an estimate of how far you still have to go. Streets may force detours, so the real walk is at least that long, never shorter. At each corner, the distance walked so far plus the straight-line distance remaining is the best case for any route through that corner. A* always continues from the corner with the best such total.

**Where the picture stops.** A walker stands in one place and must walk back to try a different street. A* does not walk. It keeps a list of every corner it could continue from and jumps to whichever is most promising, at no cost. The picture also assumes your eye judges the distance correctly. If your estimate is too high, A* may settle for a route that is not the shortest. And if you cannot see the tower at all, the estimate is useless and A* has to search in every direction.

### Proposed: The straight line to the tower

The guess at each corner is the straight-line distance to the tower. Streets may force detours, so the real walk is at least that long, never shorter. That makes the total at a corner, the distance walked so far plus the straight-line distance remaining, the best case for any route through that corner. The real trip may turn out longer than the total, but never shorter. So once A* has reached the tower, and no corner left on its list has a best case below the length of the route it found, nothing still unexplored could beat it.

**Where the picture stops.** A walker stands in one place and must walk back to try a different street. A* does not walk. It keeps a list of every corner it could continue from and jumps to whichever is most promising, at no cost. The picture also assumes your eye judges the distance correctly. If your estimate is too high, A* may settle for a route that is not the shortest. And if you cannot see the tower at all, the estimate is useless and A* has to search in every direction.


---

## Bisection Method

### Now: Finding the right setting on a dial

A shower dial is too cold at one mark and too hot at another. The comfortable setting lies between them. Turn the dial to the halfway mark and feel the water. Whichever way it is wrong tells you which half holds the right setting, and you can forget the other half for good. Each test halves the stretch of dial that is still in question.

**Where the picture stops.** A person at a shower uses more than "too hot" or "too cold". If the water is only slightly too cold, they nudge the dial a little instead of going to the halfway mark. Bisection ignores how far off the midpoint is and looks only at the sign, which is why faster methods exist. The dial also has one right setting, while a function can cross zero several times inside a bracket. Bisection then finds one of the crossings and says nothing about the others.

### Proposed: Putting numbers on the dial

Attach a number to each setting of the shower dial: how far the water is from comfortable. The number is below zero when the water is too cold, above zero when it is too hot, and exactly zero when it is right. Now the search has a precise form. You hold two settings, one where the number is negative and one where it is positive, and you want the setting where it is zero. The number at the halfway mark is negative or positive, and that sign alone says which half to keep. An equation is solved the same way. The unknown takes the place of the dial, and the expression that should equal zero takes the place of the comfort reading.

**Where the picture stops.** A person at a shower uses more than "too hot" or "too cold". If the water is only slightly too cold, they nudge the dial a little instead of going to the halfway mark. Bisection ignores how far off the midpoint is and looks only at the sign, which is why faster methods exist. The dial also has one right setting, while the quantity in an equation can cross zero several times inside the gap. Bisection then finds one of the crossings and says nothing about the others.


---

## Gradient Descent

### Now: Walking downhill in fog

You are on a hillside in thick fog and want to reach the valley floor. You cannot see the valley, but you can feel which way the ground slopes under your feet. So you take a step in the steepest downhill direction, feel the slope again, and repeat. Your stride length is the learning rate: tiny strides are safe but slow, and giant strides can carry you clear across the valley and up the other side.

**Where the picture stops.** A hiker moves smoothly. The algorithm jumps from point to point, and a jump that is too long can leap right over the valley floor and land higher up on the far side. A hillside also has only two directions to move in, while the problems solved in machine learning have millions of directions at once. And fog or no fog, a hiker who reaches a small dip may be nowhere near the deepest valley. The algorithm has the same weakness.

### Proposed: The steepest way down, and the length of your stride

Two things about the foggy hillside still need saying. First, of all the directions that lead down, you step in the steepest one. Second, the length of your stride matters. Tiny strides are safe but slow. Giant strides can carry you clear across the valley and up the other side. In the algorithm the stride length is a number you choose, called the learning rate.

**Where the picture stops.** A hiker moves smoothly and would feel the ground begin to rise. The algorithm jumps from point to point and finds out where it has landed only afterwards. A hillside also has only two directions to move in, while the problems solved in machine learning have millions of directions at once. And fog or no fog, a hiker who reaches a small dip may be nowhere near the deepest valley. The algorithm has the same weakness.


---

## Adam Optimizer

### Now: A fog walker with a memory and a separate stride for each compass direction

A walker in fog feels the slope underfoot and wants the valley floor. This walker keeps two notebooks. The first holds a running average of recent slopes, and the walker heads the way that average points, so a slope that flips back and forth is averaged away while a slope that persists builds up. The second holds, separately for north-south and for east-west, how large the slopes have typically been. Before stepping, the walker divides by the typical size in each direction. Where the ground has been steep, the stride is shortened. Where it has been gentle, the stride is lengthened. The result is a walker who covers ground at a similar pace in both directions, whatever the steepness.

**Where the picture stops.** No real walker can stride one length north-south and a different length east-west at the same moment. Adam can, because it treats every adjustable number on its own. That is also where the picture gives a warning: the adjustment works along the compass directions only. If the valley runs diagonally, both compass directions see the same mixture of steep and gentle slopes, and the separate strides help much less. The memory has a cost too. Carried by its averaged direction, the walker goes past the lowest point and has to turn back. And a real network has millions of directions, not two.

### Proposed: The fog walker's two notebooks

Give the fog walker a notebook for each kind of memory. One holds the running average of recent slopes, which sets the direction. The other holds, separately for north-south and for east-west, how large the slopes have typically been, and the walker divides by it before stepping. Notice what that division does. On steep ground a large slope is divided by a large number. On gentle ground a small slope is divided by a small number. Either way the stride comes out about the same length. The walker covers ground at a similar pace in both directions, whatever the steepness.

**Where the picture stops.** No real walker can stride one length north-south and a different length east-west at the same moment. Adam can, because it treats every adjustable number on its own. That is also where the picture gives a warning: the adjustment works along the compass directions only. If the valley runs diagonally, both compass directions see the same mixture of steep and gentle slopes, and the separate strides help much less. The memory has a cost too. Carried by its averaged direction, the walker goes past the lowest point and has to turn back.


---

## Perceptron

### Now: Nudging a ruler across a table

Lay a ruler on a table covered with two kinds of fruit. Check the fruit one by one. Each time you find a fruit on the wrong side, shift and turn the ruler toward it. Do nothing for fruit that is already on the correct side. Keep going round the table until you complete a full round without touching the ruler.

**Where the picture stops.** The ruler has no memory. A nudge that helps one fruit can push another, previously correct, onto the wrong side, which is why several rounds are needed. The size of each nudge is fixed by where the offending fruit sits, not by how wrong the ruler is. The routine stops at the first position that works, even if the ruler ends up brushing against a fruit when there was room to sit comfortably between the groups. And a ruler is straight: if the two kinds of fruit can only be separated by a curve, you will go round the table for ever.

### Proposed: What one nudge does

Watch what a single nudge of the ruler does. It shifts and turns the ruler toward one fruit that was on the wrong side, and it takes no account of any other fruit. So a nudge that helps one fruit can push another, previously correct, onto the wrong side, to be put right on a later round. That is why the ruler has to go round the table several times. The routine also stops at the first position that gets every fruit right, even if the ruler ends up brushing against a fruit when there was room to sit comfortably between the two groups.

**Where the picture stops.** The ruler is nearly the real thing: with two measurements for each fruit, the perceptron's boundary is a straight line. One detail the picture leaves vague is the size of each nudge, which is fixed by where the offending fruit sits, not by how wrong the ruler is. And a ruler is straight. If the two kinds of fruit can only be separated by a curve, you will go round the table for ever.


---

## RSA

### Now: An open padlock that anyone can snap shut

The receiver makes a padlock and a key, keeps the key, and gives copies of the open padlock to anyone who asks. A sender puts a message in a box and snaps the padlock shut. From that moment nobody can open the box, including the sender, except the person with the key. The padlock can be handed around freely because closing it teaches you nothing about how to open it.

**Where the picture stops.** A steel padlock is opened by cutting it. The RSA padlock is opened by arithmetic: anyone who can split the public number into its two primes can make the key. Nobody has proved that this splitting must be slow, and a large enough quantum computer could do it quickly. A padlock also behaves the same way every time, and for a padlock that is fine. For RSA it is a weakness: locking the same message twice gives the same result, so a spy who can guess the message can lock her guess and compare. Real systems mix random padding into the message before locking it. The picture also leaves out how a sender knows the padlock really belongs to the receiver, which needs certificates.

### Proposed: Why the padlock can be given away

The padlock is safe to hand out for one reason. Snapping it shut is something anyone can do, and doing it teaches you nothing about how to open it. Closing and opening are different acts, and only opening needs the key. That is the property RSA has to build out of numbers: a calculation that anyone can perform with the public number, and that, as far as anyone knows, can be reversed in practice only by someone who knows the secret primes. It is also why the sender, having locked the box, cannot open it again.

**Where the picture stops.** A steel padlock is opened by cutting it. The RSA padlock is opened by arithmetic: anyone who can split the public number into its two primes can make the key. Nobody has proved that this splitting must be slow, and a large enough quantum computer could do it quickly. A padlock also behaves the same way every time, and for a padlock that is fine. For RSA it is a weakness: locking the same message twice gives the same result, so a spy who can guess the message can lock her guess and compare. Real systems mix random padding into the message before locking it. The picture also leaves out how a sender knows the padlock really belongs to the receiver, which needs certificates.


---

## The other sixteen substantial revisions

These keep their picture's title but rebuild one section. They are in the full review, and are also not on the site yet:

Linear Search, Bubble Sort, Selection Sort, Union-Find (Disjoint Set Union), Breadth-First Search, Q-Learning, Kruskal's Algorithm, Fibonacci by Dynamic Programming, Sieve of Eratosthenes, Fast Fourier Transform, k-Nearest Neighbours, k-Means Clustering, Backpropagation, Convolution and Edge Detection, Rapidly-Exploring Random Tree (RRT), Graham Scan.
