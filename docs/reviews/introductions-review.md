# Algorithm Atlas: review of the introductory sections

## Summary

Of the 73 lessons, I would change **24 substantially**, **29 lightly** and **20 not at all**. "Substantially" means one section was rebuilt around a different teaching job. "Lightly" means cuts, merges, or a sentence moved or added. I recommend removing no picture outright. Eight pictures are effectively replaced and carry new titles: Insertion Sort, Merge Sort, A*, Bisection, Gradient Descent, Adam, Perceptron and RSA.

**Exponential Smoothing.** Keep the owner's restaurant and second limits paragraph as written. I recommend trimming two sentences that restate the Simple Explanation.

### Patterns

1. **The picture retells the Simple Explanation**, often with the very same example (k-Means: the notice boards twice). About thirty lessons. Remedy: give the picture the one thing the explanation asserts without explaining.
2. **The Simple Explanation previews the picture** (PageRank: the random surfer). Remedy: cut the preview.
3. **"Where the picture stops" holds limits of the method**, or things the picture shows well (Linear Regression: the far-off pin). Remedy: move them to where they teach.
4. **Later-level detail or undefined terms** arrive in the introduction (FFT: half the sampling rate; Dijkstra: "priority queue").

### Accuracy flags

In the existing text:

- **Modular Exponentiation**: the picture says four doublings and lists three. Revised to three.
- **Heap Sort**: "a single path ... to find the next largest" is loose.
- **FFT**: "two hundred times less work" depends on how operations are counted.
- **Bellman-Ford**: "no cheapest route exists" holds only for places beyond the paying loop.
- **Q-Learning**: "one walk, one junction" holds only in the simple setting.
- **Convolution**: the operation taught is cross-correlation, named convolution.
- **Dijkstra**: the phone and internet claims are fair only as "this idea".
- **Binomial Option Pricing**: a put in the explanation, a call in the worked example.

New sentences of mine that need a subject check:

- **A***: why the route found is shortest.
- **Sieve**: why each survivor is prime.
- **k-Means**: why the switching stops.
- **Backpropagation**: the cost of the slow alternative.
- **Adam**: strides of about equal length.
- **Convolution**: the total is large where the patch matches.
- **RRT**: why edge camps answer most calls.
- **Reservoir Sampling**: the three-song arithmetic.
- **Hash Table**: explicit wrap-around.
- **Breadth-First Search**: the line as the outer edge.
- **RSA**: "a calculation anyone can perform with the public number".
- **FFT**: the row of detectors is a picture, not anatomy.

### Unresolved questions

- **Critical Path**: does "Should you use it?" already say the method does not shorten a plan?
- **Diffusion Models**: should the note about the demonstration's four pictures sit beside the demonstration?
- **FFT, Needleman-Wunsch, Graham Scan, RRT, Fibonacci, Convolution, Binary Search**: are the details I removed from these introductions covered at levels 2 or 3?
- **Genetic Algorithm, Fibonacci, LZ77, Huffman, PageRank**: I cut the Simple Explanation to remove a preview of the picture. Is the owner content to lose those lines?

---

## Linear Search

`linear-search` · Algorithms and Data Structures · beginner · verdict: **substantial**

### 1. Overall diagnosis

The idea lands in the first sentence and the sock drawer is a good, homely example. The weight comes from running the same loop three times: once with socks, once more in the Simple Explanation for the computer, and a third time on the sign-up sheet. The opportunity is to keep both images but give the sheet a job the socks do not do: showing why no line can be skipped, and why "not there" costs more than "found".

### 2. Repetition map

- **Check, move on, stop at a match or at the end.** First in the sock drawer, which teaches it best. Repeated straight away for the computer (merge into one sentence, keeping only what is new: the report that the item is absent) and again on the sheet (replace with the new point below).
- **Order does not matter.** Stated in the Simple Explanation. The sheet, with names in arrival order, is the better place to show what that costs: nothing tells you where to look.
- **One item at a time, learning nothing about the rest.** Appears in the limits as a fact about the method. It is the picture's real lesson, so it moves into the picture and the limits keep only the human differences.

### 3. Revised copy

**The Simple Explanation** (revised)

Linear search is the plainest way to find something: look at every item, one after another, until you see the one you want. Think of hunting for one sock in a drawer full of loose socks. You pick up a sock and check it. If it is the wrong one, you pick up the next. You stop when you find your sock, or when the drawer is empty. A computer does the same with a list: it starts at the first item, checks each in turn, and if it reaches the end without a match it reports that the item is not there. The method always works, and the list can be in any order. Its weakness is speed. A list twice as long can take twice as many checks. That is fine for a short list. It is too slow for a huge list that gets searched again and again.

**A picture to hold on to: A name on an unsorted sign-up sheet** (title unchanged, text revised)

Someone hands you a sign-up sheet where people wrote their names in the order they arrived. To find out whether Priya signed up, you put your finger on the first line and read down, one name at a time. Arrival order tells you nothing about where her name might be, so you cannot skip a line: the one you skip could be hers. If you see her name, you stop early. To say she is not on the sheet, your finger has to reach the bottom.

**Where the picture stops** (revised)

Your eye can take in several lines at a glance and may catch a familiar name before your finger gets there. The algorithm cannot: it examines exactly one item at a time, in order. A person might also remember roughly where a name was written. Linear search remembers nothing between one search and the next.

### 4. Editorial rationale

The sheet used to be a second costume for the sock drawer. It now carries the two ideas the socks cannot: an unordered list gives no grounds for skipping anything, and proving absence takes the whole list. Both prepare the reader for the worst case in the worked example and for Binary Search. The sentence about learning nothing from unreached items left the limits because it describes the method, not a gap between the picture and the method.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Binary Search

`binary-search` · Algorithms and Data Structures · beginner · verdict: **light**

### 1. Overall diagnosis

This is one of the strongest introductions on the site. The dictionary gives the idea, the guessing game lets the reader test the halving for themselves with an exact count, and the limits name three real gaps between the game and a list. The only weight is one clause in the limits that reaches into data structures a beginner has not met.

### 2. Repetition map

- **Each look removes half.** Introduced with the dictionary, repeated in the game. The repeat should stay: the dictionary is approximate (nobody opens to the exact middle), the game is exact and playable, and "seven guesses are always enough" is a claim the reader can check.
- **How fast the range shrinks.** A thousand items in about ten looks and a million in about twenty (Simple), then a hundred in seven (game). Different scales, same rule. Keep both.
- **The list must be sorted.** Stated once, in the Simple Explanation. Correctly not repeated.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Binary search finds an item in a sorted list by cutting the list in half again and again. You already know the idea. To find a word in a paper dictionary, you do not start at page one. You open the book near the middle and look at a word. If your word comes later in the alphabet, you can ignore the whole first half. If it comes earlier, you can ignore the second half. Then you do the same with the half that is left. Each look throws away half of the remaining pages, so the pile shrinks very fast. A list of a thousand items needs about ten looks. A list of a million needs only about twenty. There is one firm condition: the list must already be in order. If it is not, a look at the middle tells you nothing about which half to keep, and the method can give wrong answers.

**A picture to hold on to: The higher-or-lower guessing game** (title unchanged, text unchanged)

A friend picks a whole number from 1 to 100 and answers each guess with "higher", "lower" or "correct". Guess 50. If the answer is "higher", the number is somewhere from 51 to 100, so guess the middle of that range. Keep guessing the middle of whatever range is left. Each answer removes half of the remaining numbers, and seven guesses are always enough, whatever number was picked.

**Where the picture stops** (revised)

In the game the number is always there. A list might not contain the target, so the search must also notice when the range has shrunk to nothing. The game also uses every number from 1 to 100 with no gaps. A real list has gaps, so binary search halves the range of positions, not the range of values, and looks at whatever value sits in the middle position. Last, your friend can answer about any guess at once. A computer can do that only if it is able to jump straight to any position in the list.

### 4. Editorial rationale

One clause removed: "which an array allows and a chain of linked items does not". The requirement it supports (being able to jump to any position) is a real difference between the game and the method and stays. The naming of two data structures is detail for a later level, and neither term is in Words to know.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Bubble Sort

`bubble-sort` · Algorithms and Data Structures · beginner · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is clear and complete, and the bubble image earns its name. The picture then replays the whole procedure with people instead of numbers: same passes, same stopping rule, nothing new. Meanwhile the most useful thing the row of people can show, that tall people travel fast and short people travel slowly, sits in the limits described as something the picture "hides". The opportunity is to let the picture teach that.

### 2. Repetition map

- **Compare neighbours, swap if out of order, pass after pass.** Taught fully in the Simple Explanation. The picture repeats it step for step. Keep one sentence of it in the picture so the scene is set, cut the rest.
- **Each pass carries the largest item to the end.** Simple Explanation (with the bubble), then the picture. Keep it in the picture only as half of the contrast with the slow traveller.
- **Stop when a pass makes no swaps.** Simple Explanation, then the picture. One closing clause in the picture is enough.
- **Uneven speed of travel.** Appears only in the limits. This is a property of the method, not a failure of the picture, and it explains why the method needs so many passes. Move it into the picture.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Bubble sort is a way to put a list in order, such as arranging numbers from smallest to largest. It may be the simplest method there is. Look at the first two items. If they are in the wrong order, swap them. Then look at the second and third items and do the same. Keep going until you reach the end of the list. That is one pass. During a pass, the biggest item gets carried all the way to the end, a little like a bubble rising to the top of a glass. Now make another pass, and the next biggest item settles beside it. Repeat until a whole pass goes by without a single swap. That means every item is in order with its neighbour, so the list is sorted. Bubble sort is easy to follow but slow on long lists. People learn it first, and then learn why other methods are faster.

**A picture to hold on to: A row of people trading places by height** (title unchanged, text revised)

People stand in a row in any order. Starting at the left, each person compares heights with the neighbour on their right, and the two trade places if the taller one is on the left. Now follow two people. The tallest person wins every comparison, so a single walk along the row carries them all the way to the right-hand end. The shortest person, if they start at the right-hand end, is less lucky: each walk gives them one trade, so they move only one place to the left per walk. That slow traveller is why a row can need many walks. When a whole walk happens with nobody trading places, the row is in height order.

**Where the picture stops** (revised)

In a real row, many pairs could trade places at the same moment, and anyone can glance along the row and see who is badly out of place. Bubble sort checks one pair at a time and never looks further than the next neighbour.

### 4. Editorial rationale

The picture now does something the Simple Explanation does not: it lets the reader follow individuals and see why the method is slow. The Simple Explanation says bubble sort is slow on long lists; the row of people shows the cause, the smallest item creeping left one place per pass. The limits are left with the two real differences between people and the algorithm.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Selection Sort

`selection-sort` · Algorithms and Data Structures · beginner · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is direct and already mentions tidying a shelf, so the bookshelf picture arrives as the same procedure told again. The detail about checking every remaining item and remembering the smallest seen so far appears in the Simple Explanation and again in the limits. The opportunity is to let the picture show the one thing a shelf makes visible, the line between the finished part and the rest, and to say the scanning detail once.

### 2. Repetition map

- **Find the smallest, swap it to the front, repeat with the rest.** Taught in the Simple Explanation. The picture repeats it. Keep the first sweep to set the scene, then use the shelf for the finished and unfinished parts.
- **A fixed spot is never touched again.** Simple ("That first spot is now finished") and picture. Keep in the picture, where it becomes the dividing line.
- **Checking every remaining item, remembering the smallest so far.** Simple Explanation and limits, nearly word for word. Keep it in the Simple Explanation, where it explains the cost. In the limits keep only the contrast with a person's glance.
- **Forgetting everything but the winner.** Limits only. Keep. It is the sharpest difference between a person and the method.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Selection sort is a way to put a list in order, such as arranging numbers from smallest to largest. It works the way many people tidy a shelf. Look through the whole list and find the smallest item. Move it to the front by trading places with whatever was there. That first spot is now finished. Next, look through the rest of the list and find the smallest item that is left. Trade it into the second spot. Keep going, one spot at a time, until every spot holds the right item. To find the smallest item, the method checks every remaining item in turn and remembers the smallest it has seen so far. It does all of that checking even when the list was already in order, so it is slow on long lists. Its strength is that it moves items very rarely: at most one trade for each spot.

**A picture to hold on to: Lining up books by height** (title unchanged, text revised)

To arrange a shelf of books from shortest to tallest, run your finger along the whole shelf, find the shortest book, and swap it with the book at the left-hand end. From then on the shelf has two parts. On the left are the books already in place, in order and never touched again. On the right are the rest. Each sweep covers only the right-hand part and moves one more book across the line, so the sweeps get shorter as the shelf fills in.

**Where the picture stops** (revised)

A person can spot the shortest book on a shelf at a glance. A computer cannot glance: it has to look at every remaining book, one at a time, on every sweep. A person would also remember which books were nearly the shortest. Selection sort forgets everything it learned in a sweep except the one winner, and starts the next sweep from nothing.

### 4. Editorial rationale

The picture keeps the author's shelf but stops retelling the steps. It now shows the boundary that the worked example and Words to know call the sorted part, and the fact that each sweep is shorter than the last. The duplicated clause about remembering the smallest seen so far is said once, in the Simple Explanation.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Insertion Sort

`insertion-sort` · Algorithms and Data Structures · beginner · verdict: **substantial**

### 1. Overall diagnosis

The card-sorting explanation is exactly right for this method and the limits name the true cost, the copying needed to open a gap. The problem is that the picture is the same hand of cards the reader has just finished reading about. The opportunity is to turn the picture into a close-up of one card going in, which is what the Simple Explanation skips and what explains its claim about nearly sorted lists.

### 2. Repetition map

- **Each new card goes into its place among the cards already held.** Taught well in the Simple Explanation. The picture repeats it under almost the same title. Replace the retelling with the close-up.
- **Quick when the list is nearly in order.** Asserted in the Simple Explanation ("each item is then close to where it belongs"). Not shown anywhere. The close-up can show it: a card that is already the largest is placed after one look.
- **Glance versus one comparison at a time.** Limits only. Keep, reworded so it does not contradict a picture that now looks along the cards one by one.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Insertion sort is a way to put a list in order, and it is how most people sort a hand of playing cards. Pick up the cards one at a time. The first card is in order by itself. Take the second card and put it before or after the first, whichever is right. Take the third card and slide it into the right place among the first two. Carry on like this. Each new card goes into its correct place among the cards you already hold, so the cards in your hand are always in order. When there are no cards left to pick up, the whole hand is sorted. This method is quick when the list is short. It is very quick when the list is almost in order already, because each item is then close to where it belongs. On a long, jumbled list it is slow, because items have to travel a long way.

**A picture to hold on to: One card going into a sorted hand** (title changed, text revised)

Look closely at a single card going in. You hold a few cards in your left hand, already in order, and pick up one more. You look along the held cards from the right, largest first, and stop at the first one that is not larger than the new card. The new card slides in just after it. If the new card is larger than everything you hold, one look settles it. If it is the smallest, you look at every card in your hand.

**Where the picture stops** (revised)

With real cards, opening a gap is a single motion of the fingers. In a list stored in a computer, there is no free space between items: every larger value has to be copied one place to the right, one at a time, and that copying is where most of the time goes. A real card player also finds the place at a glance. The algorithm has no glance and compares one card after another.

### 4. Editorial rationale

The Simple Explanation tells the whole story of the hand. The picture now slows down one step of it. That gives the reader the mechanism behind two claims made earlier without support: a nearly ordered list is fast because each search stops almost at once, and a jumbled list is slow because many searches run the length of the hand. The title changed so that it no longer repeats the Simple Explanation's own example word for word.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Merge Sort

`merge-sort` · Algorithms and Data Structures · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is a model of sequence: first the easy trick, then the way the trick is reused. The picture then spends most of its length explaining the merge a second time, with exam papers instead of cards, and reaches its one new idea, the helpers, in a final sentence. That idea matters. It is the "sort each half the same way" view of the method that the takeaway uses. The opportunity is to build the picture around the helpers.

### 2. Repetition map

- **Merging two ordered piles by always taking the smaller top item.** Taught best in the Simple Explanation with two piles of cards. Retold in the picture with two stacks of papers. Reduce to two sentences in the picture, as the thing done when the halves come back.
- **Splitting down to single items.** Simple Explanation, from the bottom up (singles, pairs, fours). The picture's helpers show the same thing from the top down. This is a second perspective, not a repeat. Keep and expand.
- **The picture stops at a few helpers.** Limits. No longer needed once the picture runs all the way down to a single paper.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Merge sort is a way to put a list in order by splitting one big job into smaller jobs. It rests on one easy trick. Suppose you have two piles of cards, and each pile is already in order. You can combine them into a single ordered pile quickly. Look at the top card of each pile, take the smaller one, and repeat until both piles are gone. That is called merging. Merge sort uses this trick again and again. Cut the list in half. Cut each half in half, and keep cutting until every piece is a single item. A single item is already in order. Now merge the pieces in pairs to make ordered pieces of two. Merge those to make ordered pieces of four, and carry on until one ordered list remains. Merge sort does about the same amount of work whatever order the list starts in, so no input can catch it out.

**A picture to hold on to: A stack of exam papers and two helpers** (title changed, text revised)

A teacher has a tall stack of exam papers to sort by student name. The teacher splits the stack in two and hands each half to a helper with one request: bring it back sorted. When the two sorted stacks come back, combining them is easy. Look at the top paper of each stack, move whichever name comes first onto a new stack, and repeat. Nobody ever looks below the top of a stack. Each helper does the same with their own half: split it, hand the halves on, and merge what comes back. The handing-on stops when someone is given a single paper, which is already sorted.

**Where the picture stops** (revised)

The desk in this picture has room for a third stack. A computer has to set that room aside: merge sort needs spare memory as large as the list it is sorting. The helpers in the picture also work at the same time, while the algorithm on this page finishes one half completely before it starts the other.

### 4. Editorial rationale

The Simple Explanation builds the sorted list upward from single items. The picture now shows the same method from the other end, as a job handed down and merged on the way back, which is how the code at the next level is written. Readers get two views that support each other, where before they got the merge twice. The third limitation was a limit of the old picture's wording, not of the idea, and the new picture removes the need for it.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Quick Sort

`quick-sort` · Algorithms and Data Structures · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation states the idea plainly and the volunteer is a fine picture of it, concrete where the explanation is abstract. Two things need attention. The opening compares the task to sorting a hand of cards, which is the image the Insertion Sort lesson uses for a different method. And the method's one real weakness appears only in the limits, described as something the picture hides, when the picture shows it better than anything else could.

### 2. Repetition map

- **Pick one item, smaller to one side, bigger to the other, repeat inside each side.** Simple Explanation in the abstract, picture in the concrete. The repeat is useful because the Simple Explanation has no example of its own. Keep both.
- **The picked item is now in its final place.** Simple Explanation and picture. A central and surprising fact. Keep both.
- **Bad pivots make it slow.** Limits only, filed as a limit of the picture. It is a limit of the method. State it in one sentence in the Simple Explanation and show the reason in the picture.

### 3. Revised copy

**The Simple Explanation** (revised)

Quick sort is a way to put a list in order, such as arranging numbers from lowest to highest. It works by picking one item from the list and asking the same question of every other item: are you smaller or bigger than this one? Smaller items go to one side. Bigger items go to the other side. The item you picked is now sitting in exactly the right spot, and it never has to move again. Then you do the same thing inside each side. The groups keep getting smaller until each one holds a single item. At that point the whole list is in order. Computers sort lists all day long: names, prices, scores, search results. Quick sort matters because, on most lists, it gets the job done with very little work. It turns slow when the picked item keeps turning out to be among the smallest or biggest in its group.

**A picture to hold on to: Sorting a class by height with one volunteer** (title unchanged, text revised)

Ask one student to stand still. Everyone shorter moves to their left, everyone taller to their right. That student is now standing in exactly the right place in the final line, even though neither group is sorted yet. Repeat inside each group with a new volunteer, and keep going until every group is a single person. How quickly this ends depends on the volunteers. A volunteer of middling height splits a group into two smaller ones. A volunteer who is the shortest or tallest of the group leaves everyone else in one group, and if that happens every time, each round places only one person.

**Where the picture stops** (revised)

A class can shuffle around all at once, with everyone checking their height against the volunteer at the same moment. A computer running quick sort checks one item at a time. That is why we measure its work by counting comparisons.

### 4. Editorial rationale

The bad-pivot case is the essential qualification for this method, so the reader should meet it in the explanation and see its cause in the picture, not find it under a heading about the picture's shortcomings. The opening no longer borrows the card-sorting image, which could leave a reader of both lessons thinking quick sort is how people sort cards.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Heap Sort

`heap-sort` · Algorithms and Data Structures · intermediate · verdict: **none**

### 1. Overall diagnosis

The three sections each do a different job. The Simple Explanation defines the heap and the take-and-repair loop. The tournament explains why the repair is cheap, which the explanation only asserts. The limits then say exactly where a heap is weaker and simpler than a bracket, and end on the point the worked example depends on: the heap is the list itself. No change.

### 2. Repetition map

- **Repair touches only one path from top to bottom.** Asserted in the Simple Explanation, explained in the picture through the runner-up. The second mention adds the reason. Keep both.
- **The largest item is always on top.** Simple Explanation and, implicitly, the champion. Needed to connect the two. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Heap sort is a way to put a list in order by picking out the biggest item again and again. Finding the biggest item in a jumbled list is slow, because you have to look at every item. Heap sort avoids that by first arranging the items in a pattern called a heap. Picture a chart like a family tree. One item sits at the top, two sit below it, two below each of those, and so on. The rule is that every item is at least as big as the two items directly below it. With that rule, the biggest item is always at the top. Heap sort takes the top item and puts it at the back of the list, where it belongs. Then it repairs the chart, which takes only a few steps, because only one path from top to bottom needs fixing. Now the next biggest item is at the top. Take it, repair, and repeat until nothing is left.

**A picture to hold on to: Finding the runner-up in a knockout tournament** (title unchanged, text unchanged)

After a knockout tournament everyone knows the champion. To find the second-best player there is no need to play the whole tournament again: the runner-up must be someone the champion beat, and that is only one player per round. A heap works in a similar way. Once the largest value has been taken from the top, only the values along a single path from top to bottom need to be compared to find the next largest. For a thousand values that is about ten levels, not a thousand checks.

**Where the picture stops** (unchanged)

A tournament bracket writes every player at the bottom and copies winners upward, so names appear several times. A heap stores each value once and promises less: only that a parent is at least as large as its children. Two values on different branches are in no known order. A heap also needs no bracket drawn anywhere. It is just the list itself, read with a rule that says which positions count as children of which.

### 4. Editorial rationale

No edits. The picture adds the reason behind a claim, and every limitation listed is a difference between a tournament and a heap, not a caveat about heap sort.

### 5. Accuracy flags

The picture says only the values along a single path "need to be compared to find the next largest". Strictly, the next largest is one of the top item's two children; the single path is what the repair walks down, comparing the moved item with both children at each level. The sentence is true of the repair but loose about the finding. Worth a look by whoever owns the lesson.

### 6. Unresolved questions

None.

---

## Counting Sort

`counting-sort` · Algorithms and Data Structures · intermediate · verdict: **light**

### 1. Overall diagnosis

The two sections complement each other well. The tally chart teaches what counting sort does; the pigeonholes show the idea underneath it, that an item's value alone says where it goes; and the first limitation ties the two together by explaining why the real method must count before it places. The one misfiled piece is the warning about a huge range, which is a limit of the method that the wall of pigeonholes shares, not a place where the picture fails.

### 2. Repetition map

- **No item is compared with another.** First sentence of the Simple Explanation, then "no letter is ever held up against another letter". The picture makes an abstract claim visible. Keep both.
- **Wasteful when the range is huge.** Stated in the Simple Explanation as the essential condition, then again in the limits with the phone-number wall. The second telling is more vivid and worth keeping, but it belongs in the picture, since the picture has the same weakness as the method.
- **Why two passes.** The Simple Explanation describes the two passes; the limits explain why the first is needed. A real addition. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Counting sort puts a list in order without asking which of two items is bigger. It works when the items are whole numbers from a small range, such as exam marks from 0 to 100. Imagine sorting a big pile of exam papers by mark. Draw a tally chart with one row for each possible mark. Go through the pile once and add a tally for each paper. Now you know how many papers got each mark. From that you can work out where every group belongs in the finished pile. If three papers scored 0 and five scored 1, then the papers that scored 2 must start at the ninth place. Go through the pile a second time and put each paper straight into its place. This is very fast when the range of marks is small. It is wasteful when the range is huge, because the chart needs a row for every possible value, whether or not any paper has it.

**A picture to hold on to: Pigeonholes in a sorting office** (title unchanged, text revised)

A sorting office has a wall of pigeonholes, one for each delivery district, arranged in order. A clerk picks up each letter, reads its district number, and drops it into that pigeonhole. No letter is ever held up against another letter. When the sack is empty, walking along the wall from the first hole to the last collects the letters in district order. The wall works because the districts are few. A hole for every possible phone number would fill the building with empty holes, and walking past them all would take longer than sorting the letters any other way.

**Where the picture stops** (revised)

A pigeonhole can hold any number of letters, but a block of computer memory cannot stretch. That is why counting sort makes a counting pass first: it has to know how much room each value needs before it writes anything.

### 4. Editorial rationale

The limits now hold the single place where the pigeonholes and the real method part company, and it is the difference that explains the method's shape. The phone-number wall moved up into the picture because it is true of both. "Key" became "value" in the limits because the word is not introduced until the worked example.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Hash Table with Linear Probing

`hash-table` · Algorithms and Data Structures · intermediate · verdict: **light**

### 1. Overall diagnosis

The cloakroom explains the whole mechanism clearly, including collisions and failed lookups. The parking street then walks through the same mechanism again, and its two real contributions are easy to miss: the street is a ring, and there is a reason a search can stop at the first gap. The limits do good work on removal and on what a hash function is like. The opportunity is to cut the replay in the picture and bring its two new ideas forward.

### 2. Repetition map

- **If your place is taken, take the next free one; search the same way.** Taught in the cloakroom, retold on the street. Keep a short version on the street to set up the argument that follows.
- **An empty place means "not here".** Asserted in the Simple Explanation. The picture gives the reason (no gap existed between the assigned space and the one taken). This is the picture's best contribution. Keep and make the conclusion explicit.
- **One slot at a time versus a glance.** Limits. It repeats what both stories already show. Remove.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A hash table stores things so that you can find any one of them almost at once, without searching through the rest. Think of a cloakroom with a row of numbered hooks. When you hand in a coat, the attendant uses a fixed rule to turn your ticket number into a hook number, and hangs the coat there. When you come back, the same rule gives the same hook, so the attendant walks straight to it. Sometimes the rule sends two tickets to the same hook. The version in this lesson handles that simply: if the hook is taken, try the next hook along, then the next, until one is free. To find a coat later, start at its hook and walk along in the same way until you see it. If you reach an empty hook first, the coat is not there. This works well while plenty of hooks are free. As the rack fills, taken hooks bunch together and the walks get longer.

**A picture to hold on to: Assigned parking on a ring road** (title unchanged, text revised)

Every resident of a circular street has an assigned parking space worked out from their house number. If someone else is already in your space, you drive on and take the next free one. Because the street is a ring, driving past the last space brings you round to the first. To find a neighbour's car, go to their assigned space and walk forward from there. You will reach the car before you reach a gap, because when they parked there was no gap between their assigned space and the one they took. That is why an empty space proves the car is not on the street.

**Where the picture stops** (revised)

On a real street cars drive away and leave gaps. In the table a gap means "stop looking", so an item that is removed must leave a marker behind, or items parked beyond it would be lost. And the rule that assigns places, called the hash function, does not follow house numbers along the street: a good one scatters items so that similar ones land far apart.

### 4. Editorial rationale

The Simple Explanation tells the reader that an empty hook ends the search. The picture now says why that is safe, which is the argument the whole method rests on, and states the wrap-around that its title promises. The limits lost a sentence that told the reader something both stories had already shown, and "hash function" is now tied back to the "fixed rule" of the Simple Explanation so the term does not arrive unexplained.

### 5. Accuracy flags

The revised picture states outright that the search wraps from the last space to the first. The original implies this with "circular street". Confirm it matches the lesson's implementation.

### 6. Unresolved questions

None.

---

## Union-Find (Disjoint Set Union)

`union-find` · Algorithms and Data Structures · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The school story explains the problem and the mechanism in one go, and the limits are excellent: they explain why the structure may rearrange itself and say that merges cannot be undone. The picture is the weak part. Bosses and chief executives are captains and circles under new names, told at the same length. Its one new thought, that a merger is a single change, comes in the last clause. The opportunity is to make that the point of the picture.

### 2. Repetition map

- **Follow the chain to the leader.** Taught in the Simple Explanation with captains. Repeated in full with bosses. Keep one sentence.
- **Same group exactly when the chains end at the same person.** Simple Explanation, then the picture, nearly word for word. Remove from the picture.
- **Merge by pointing one leader at the other.** Simple Explanation, then the picture. The picture adds the consequence: nobody else changes anything, yet everyone has moved. Keep and expand, because this is why the design is used.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Union-find keeps track of which things belong to the same group while groups keep merging. Picture a school where friend circles form over time. At first every student is alone. Whenever two students become friends, their two circles join into one. At any moment you may want to ask: are these two students in the same circle? Union-find answers that quickly. Each circle has one member who acts as its captain. Every other student remembers just one person in the circle, someone a step closer to the captain. To find your captain, you ask that person, who asks theirs, and so on, until the chain reaches the captain. Two students are in the same circle exactly when they reach the same captain. To merge two circles, one captain simply starts pointing to the other. Two small habits keep these chains short, so even with millions of students each question takes only a few steps.

**A picture to hold on to: Companies that keep merging** (title unchanged, text revised)

Every employee knows one thing: who their boss is. Nobody holds a list of who works for which company. To learn which company someone belongs to, follow the chain of bosses up to the one person with no boss, the chief executive. When two companies merge, one chief executive starts reporting to the other. Nothing else changes and nobody else is told, yet every chain that ended at the old chief executive now runs on to the new one. In that single change everyone below has joined the bigger company.

**Where the picture stops** (unchanged)

In a real company the chain of bosses means something. Here the links are bookkeeping and nothing else: who points to whom says nothing about the items except which group they are in. That is why the structure is free to rearrange itself, pointing everyone it passes straight at the top, which no real organisation would do. Real companies can also split up again. Union-find cannot undo a merge.

### 4. Editorial rationale

The Simple Explanation already teaches how to find a leader and how to merge. The picture now answers a question it leaves open: why store groups this way at all? Because membership is never written down, merging two groups of any size costs one change. That is a new idea for the reader, and it leads straight into the limits, which explain what else this bare bookkeeping makes possible.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Breadth-First Search

`bfs` · Graph Theory · beginner · verdict: **substantial**

### 1. Overall diagnosis

The rumour spreading day by day is an excellent example: it is a network, it moves in whole steps, and it makes the layers obvious. The ripple then says the same thing again with rings in place of days, and it is the weaker of the two images, because water has no nodes or steps. Its limits have to walk back the two things it gets wrong. The opportunity is to give the ripple a job the rumour does not do: showing what the waiting line is for.

### 2. Repetition map

- **Everything one step away, then two, then three.** Taught by the rumour. Repeated by the rings. Keep one sentence in the picture.
- **The queue keeps the order.** Introduced in the Simple Explanation as a waiting line, with no reason given for why a line produces layers. Mentioned again in the limits. Bring it into the picture, where the ring can show what the line holds.
- **First arrival is a shortest route.** Simple Explanation, then "never skips ahead" in the picture. Keep both, briefly: the second gives the reason in three words.
- **Steps, not distance.** Limits only. A real gap between the picture and the method, and a pointer to Dijkstra. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Breadth-first search is a way to explore a network of connected things, one layer at a time. Think of a rumour spreading through a school. On day one, a single student knows it. On day two, all of that student's friends know. On day three, the friends of those friends know, and so on. Breadth-first search explores in the same order. It starts at one point. It visits everything one step away, then everything two steps away, then three. To keep that order straight, it uses a waiting line. Each newly found point joins the back of the line, and the next point to explore always comes from the front. Because it works outward in layers, the first time it reaches a point, it has found a route there with the fewest possible steps. That is why it can find the shortest way through a maze, or the smallest number of introductions that connect two people.

**A picture to hold on to: Ripples from a stone dropped in a pond** (title unchanged, text revised)

Drop a stone into still water and a ring spreads outward. Everything inside the ring has been reached and nothing beyond it has. The ring reaches nearby points first and distant points later, and it never skips ahead. In breadth-first search the waiting line plays the part of the ring. The points in the line are the outer edge of what has been found so far, and exploring from the front of the line pushes that edge outward one step at a time.

**Where the picture stops** (revised)

A ripple touches every point on a ring at the same moment. The algorithm visits one point at a time, taking them in the order of the line. A ripple also travels real distance, while the search only counts steps: a long road and a short road each count as one. When the lengths matter, the picture is still right but the algorithm must change to Dijkstra's.

### 4. Editorial rationale

The picture used to be a second telling of the layers. It now connects the image to the one piece of machinery the Simple Explanation introduces without explaining, the waiting line, so the reader arrives at the worked example knowing what the line contains and why. The vocabulary also stays with the Simple Explanation's "points" and "steps" until Words to know introduces nodes, edges and the queue.

### 5. Accuracy flags

The revised picture says the points in the line are the outer edge of what has been found. That is the standard description of the queue's contents (found but not yet explored), and at any moment they span at most two neighbouring layers. Worth a quick check against the lesson's own wording at level 2.

### 6. Unresolved questions

None.

---

## Depth-First Search

`dfs` · Graph Theory · beginner · verdict: **light**

### 1. Overall diagnosis

The maze is the right example and the Simple Explanation walks it well. The picture goes back into the same maze and repeats the walk, when what it has to offer is the equipment: string and chalk, and what each one is for. The limits are strong, especially the point that the string's route is not a shortest route. The last limitation, about the effort of winding string, is true but teaches nothing the reader needs.

### 2. Repetition map

- **Go forward, back up at a dead end, try the last untried passage.** Taught in the Simple Explanation. Retold in the picture. Remove the retelling.
- **Mark each place; remember the route.** Simple Explanation names both needs. The picture turns them into chalk and string and then into the stack and the discovered record. That mapping is the picture's job. Keep and make it the whole picture.
- **Not the shortest way.** Limits only. A property of the method that the string shows well. Keep where it is, since the Simple Explanation makes no claim about route length.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Depth-first search is a way to explore a network of connected places. It follows one route as far as it goes before trying another. Think of exploring a maze. You walk forward, and at every junction you take a passage you have not tried yet. You keep going until you reach a dead end or a place you have already been. Then you walk back to the last junction that still has an untried passage, and take it. To avoid going round in circles, you mark each place the first time you step into it. To find your way back, you remember the route you came by. When you have backed all the way out to the start and no untried passage is left, you have visited every place that can be reached. Computers use this method to solve puzzles, to find loops in a network, and to work out which jobs must be done before others.

**A picture to hold on to: Exploring a maze with a ball of string** (title unchanged, text revised)

Take two things into the maze: a ball of string and a piece of chalk. Tie the string at the entrance and unwind it as you walk, and chalk a mark at every junction you enter. The chalk answers one question: have I been here before? The string answers another: how do I get back to the last junction? At any moment the string traces the route from the entrance to where you stand, and winding it back one junction is how you back up. In the algorithm the string is called the stack, and the chalk marks are the record of places already discovered.

**Where the picture stops** (revised)

A person in a maze can see down a corridor and guess which way looks promising. The algorithm has no such sense: it tries passages in whatever order they are listed. The string shows a way back to the entrance, not the shortest way. A place right next to the entrance may be reached only at the end of a long winding route.

### 4. Editorial rationale

The Simple Explanation says the walker must mark places and remember the route. The picture now gives each of those needs an object and a name, which is what the reader needs for the worked example, where the stack is written out. The sentence about the effort of winding string went because it corrects a misunderstanding few readers would form.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Topological Sort (Kahn's Algorithm)

`topological-sort` · Graph Theory · intermediate · verdict: **light**

### 1. Overall diagnosis

Getting dressed is a quick, friendly way into "this before that", and the procedure that follows is clear. The course catalogue then repeats that procedure step for step. The most important thing the reader has not yet been told, that there are usually many valid orders and the method returns one of them, is in the limits. A course plan shows this naturally, so the picture should carry it.

### 2. Repetition map

- **Do a job that waits for nothing, cross off its rules, repeat.** Taught in the Simple Explanation. Repeated with courses. Keep a compressed version to set the scene.
- **Getting stuck means the rules form a circle.** Simple Explanation, then the picture. The repeat is short and the two-course example is concrete. Keep.
- **One valid order among many.** Limits only. This is a property of the method, not a shortcoming of the picture. Move into the picture, where "several courses are available at once" makes it visible.
- **Fewest terms.** Limits. A true gap between the catalogue and the method. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Topological sorting puts a set of jobs in an order that obeys every "this before that" rule. Think of getting dressed. Socks go on before shoes. Trousers go on before a belt. A shirt goes on before a jacket. No single rule gives you the whole order, but together they forbid many orders. Here is a way to find one that works. Look for a job that is waiting for nothing, and do it. Cross off every rule that starts with that job. Some other jobs may now be waiting for nothing, so they are ready too. Keep doing a ready job and crossing off its rules until every job is done. If you get stuck with jobs left over, the rules must go round in a circle, such as A before B and B before A. Then no order can work. Computers use this method to decide which files to build first and which spreadsheet cells to calculate first.

**A picture to hold on to: Choosing courses with prerequisites** (title unchanged, text revised)

A course catalogue lists which courses must be passed before others. To plan a degree, write down any course with no prerequisites, then cross it off the prerequisite lists of the other courses. Some of those now have empty lists, so they become available. Often several courses are available at once. Any of them can go next, and each choice leads to a different plan that still obeys the catalogue. The method finds a valid order, not the only one. If two courses each list the other as a prerequisite, neither ever becomes available, and the catalogue has a mistake.

**Where the picture stops** (revised)

A student can take several courses in the same term. The algorithm writes one line, a single course at a time, so its answer says nothing about how to finish in the fewest terms. Real prerequisites can also be waived or satisfied in alternative ways. The algorithm treats every rule as absolute.

### 4. Editorial rationale

A reader who believes there is one correct order will be puzzled when the worked example's answer differs from their own. The picture now prevents that. The limits keep the two places where a real catalogue differs from the method. "Arrow" became "rule" because the Simple Explanation has not yet introduced arrows.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Dijkstra's Algorithm

`dijkstra` · Graph Theory · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation is a clear, complete walk through the method in the language of towns and roads. The water picture is a good choice because it shows why the nearest unfinished town can safely be finished. But it is written in the vocabulary of a later level (source node, edge weights, priority queue), in three dense sentences, straight after an explanation that used none of those words. And the method's one condition, no negative costs, appears only at the very end of the limits.

### 2. Repetition map

- **Nearest unfinished town next.** Taught in the Simple Explanation with the reason "nothing closer is left". The water front gives the same fact a physical cause. This is the best kind of repetition. Keep, and say plainly how the two connect.
- **One at a time, so a waiting list is needed.** Picture ("priority queue") and limits ("waiting list"). Say it once, in the limits, with both names.
- **No negative costs.** Limits only. It is a condition of the method, so it needs one sentence in the Simple Explanation. The pipe that cannot have a negative length then explains it.

### 3. Revised copy

**The Simple Explanation** (revised)

Dijkstra's algorithm finds the cheapest way to get from one place to every other place on a map. Picture towns joined by roads, where each road has a cost, such as minutes of driving. You start at home, which costs nothing to reach. Then you look for the nearest town you have not finished with. Nothing closer is left, so you already know the cheapest way to get there. Mark that town as finished. Next, check each road leading out of it. If going through this town gives a cheaper way to reach a neighbour, write down the new, lower cost. Now repeat: pick the nearest unfinished town, finish it, update its neighbours. When every town is finished, you know the cheapest cost to reach each one, and the route that gets you there. The method relies on one condition: no road may have a negative cost. Phones use this idea to plan journeys. The internet uses it to decide where to send data.

**A picture to hold on to: Water spreading through pipes** (title unchanged, text revised)

Build the map out of pipes, each as long as its road is costly, and pour water in at the starting town. The water front reaches each junction at a time equal to its cheapest cost from the start, and it reaches the junctions in order of that cost, nearest first. Dijkstra's algorithm follows the front. Finishing the nearest unfinished town is the water arriving there. Water still on its way along other pipes cannot arrive any sooner, which is why that town's cost is final.

**Where the picture stops** (revised)

Real water flows down every pipe at once. The algorithm deals with one junction at a time, so it needs a waiting list, called a priority queue, to tell it which junction comes next. The picture also assumes every pipe has a real length. A road with a negative cost has no meaning for water, and it breaks the algorithm too.

### 4. Editorial rationale

The picture keeps its idea and changes its language to match what the reader has just read. It also gains the sentence that makes it useful: the link between the water arriving and a town being finished. Stating the no-negative-costs condition in the Simple Explanation follows the pattern of Binary Search, where the one firm condition is part of the explanation. The pipes then give the reason.

### 5. Accuracy flags

"Phones use this idea to plan journeys. The internet uses it to decide where to send data." Fair as written ("this idea"), though real route planners use heavily adapted versions. No change proposed.

### 6. Unresolved questions

None.

---

## Bellman-Ford Algorithm

`bellman-ford` · Graph Theory · intermediate · verdict: **none**

### 1. Overall diagnosis

Each section adds something. The Simple Explanation gives the patient sweep and the meaning of a negative cost. The signposts explain something the sweep does not: news travels one road per round, so a map of V towns needs at most V − 1 rounds. The limits then correct the two places where the story and the algorithm differ, and the second resolves a loose end in the Simple Explanation (how the method "says so" when costs never stop falling). The limits are long, but each sentence is doing work. No change.

### 2. Repetition map

- **Take any improvement on offer and write it down.** Simple Explanation ("write down the lower cost") and picture ("repaints the sign"). Needed so the reader can map one story onto the other. Keep.
- **One sweep is not enough.** Simple Explanation says so; the picture explains how many are enough. Keep both.
- **A paying loop.** Simple Explanation, then the limits, which add how the algorithm detects it. Keep both.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The Bellman-Ford algorithm finds the cheapest route from one place to every other place on a map. It still works when some roads have a negative cost, meaning that travelling the road earns you something back. Picture a delivery driver. Most roads cost fuel, but one road has a paying job on it. The method is patient. Write zero next to the start and "unknown" next to every other place. Then go through the whole list of roads. For each road, ask one question: does taking this road reach its far end more cheaply than the best known so far? If it does, write down the lower cost. One sweep through the list is not enough, because a new low cost in one place can lead to new low costs further on. So sweep again, until a whole sweep changes nothing. If the costs never stop falling, some loop of roads pays you every time you drive round it. Then no cheapest route exists, and the method says so.

**A picture to hold on to: Towns passing on news of a cheaper route** (title unchanged, text unchanged)

Every town keeps a signpost showing the cheapest known cost of reaching it from the capital. Once a day, each town tells its neighbours: "you can be reached through me for my cost plus the road between us." A town that hears a better offer than its signpost shows repaints the sign. News of a cheap route spreads one road further each day. If the map has V towns, any sensible route uses at most V − 1 roads, so after V − 1 days every signpost is right.

**Where the picture stops** (unchanged)

In the story every town speaks at the same moment, and news moves exactly one road per day. The algorithm on this page checks roads one at a time in a fixed order and uses each new number immediately, so in one pass good news can travel along several roads if they happen to be listed in a helpful order. That is why it often finishes early. The story also has no ending when a loop of roads pays out: the towns would repaint their signs for ever. The algorithm stops after V − 1 passes and uses one more scan to detect the loop.

### 4. Editorial rationale

No edits. This is a good example of a picture that explains a number the Simple Explanation could only assert.

### 5. Accuracy flags

"Then no cheapest route exists" is true for places that can be reached by way of the paying loop, not necessarily for every place on the map. Acceptable at this level; the precise statement belongs further down the page.

### 6. Unresolved questions

None.

---

## A* Search

`a-star` · Artificial Intelligence · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is very good: two questions at each corner, one total, and a clear statement of the condition under which the answer is truly shortest. The picture then returns to the same tower in the same town. Most of it restates the two questions. Its one new idea is the important one: a straight line can never be longer than the real walk, so each corner's total is a best case. The opportunity is to give the picture to that idea alone, because it is the reason behind the condition the Simple Explanation states.

### 2. Repetition map

- **Distance walked plus distance still to go.** Taught in the Simple Explanation. Repeated in the picture. Keep only the clause needed to name the total.
- **Always continue from the corner with the smallest total.** Simple Explanation, picture, and again in the limits (the list of corners). Keep in the Simple Explanation and the limits, where it marks the difference from a walker. Remove from the picture.
- **The guess must never be too high.** Simple Explanation states the condition. The picture explains why a straight line meets it. The limits say what happens when it is broken. Three mentions, three different jobs. Keep all three.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A* (say "A star") is a way to find the shortest route to a goal without wasting time searching in the wrong directions. Imagine crossing a city on foot toward a tall tower you can see in the distance. At every street corner you could ask two things. How far have I walked to get here? And how far does it still look to the tower? Add the two numbers, and you have a guess at the length of a whole trip through that corner. A* keeps a list of corners it could explore next, and it always picks the one with the smallest total. Corners that lead away from the tower get large totals, so they wait at the bottom of the list. Many are never explored at all. If the "how far does it look" guess never says the goal is farther than it really is, the route A* finds is truly the shortest. Video games use it to move characters, and robots use it to plan their paths.

**A picture to hold on to: The straight line to the tower** (title changed, text revised)

The guess at each corner is the straight-line distance to the tower. Streets may force detours, so the real walk is at least that long, never shorter. That makes the total at a corner, the distance walked so far plus the straight-line distance remaining, the best case for any route through that corner. The real trip may turn out longer than the total, but never shorter. So once A* has reached the tower, and no corner left on its list has a best case below the length of the route it found, nothing still unexplored could beat it.

**Where the picture stops** (unchanged)

A walker stands in one place and must walk back to try a different street. A* does not walk. It keeps a list of every corner it could continue from and jumps to whichever is most promising, at no cost. The picture also assumes your eye judges the distance correctly. If your estimate is too high, A* may settle for a route that is not the shortest. And if you cannot see the tower at all, the estimate is useless and A* has to search in every direction.

### 4. Editorial rationale

The Simple Explanation tells the reader that a guess which never overshoots guarantees the shortest route. That is the hardest claim in the lesson and it was left unsupported. The picture now supplies the reason in the reader's own terms: a total that cannot be beaten is a promise about every route through that corner. The title changed because the old one described the Simple Explanation's example, not what the picture adds.

### 5. Accuracy flags

The last sentence of the revised picture is a compressed version of the standard argument for why A* is optimal with an estimate that never overshoots. It was not in the original text. Please check it against the lesson's level 2 wording before using it.

### 6. Unresolved questions

None.

---

## Minimax with Alpha-Beta Pruning

`minimax` · Artificial Intelligence · intermediate · verdict: **none**

### 1. Overall diagnosis

This is one of the longest introductions on the site, and the length is earned. The Simple Explanation describes looking ahead and working backwards in a real game. The bags strip the same idea down to one choice and one reply, where "pick the bag whose worst item is best" can be seen at a glance, and they make the shortcut concrete with two numbers. The limits then rebuild the distance between a bag and a game. No change.

### 2. Repetition map

- **Assume the other player picks what is worst for you.** Simple Explanation, picture and limits. The first states it, the second lets the reader do it, the third says what it costs against a fallible opponent. Keep all three.
- **The shortcut.** Simple Explanation in the abstract, picture with the numbers 4 and 2, and the worked example straight after with the same numbers. Abstract, then concrete, then worked in full is a sound sequence, and the bags are the clearest of the three. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Minimax is how a computer chooses a move in a game for two players, such as noughts and crosses or chess. It looks ahead. It imagines each move it could make, then each reply the other player could make, then its own answers to those, and so on. At the end of every imagined line of play it writes down a score: high if the game went well for the computer, low if it went badly. Then it works backwards. On its own turns it assumes it will pick the move with the highest score. On the other player's turns it assumes they will pick the move with the lowest score, the one that is worst for the computer. The move that still comes out best is the one it plays. There is also a shortcut, called alpha-beta pruning. Once one reply shows that a move is worse than a move already found, the computer stops looking at that move. Its other replies no longer matter. The shortcut never changes the answer. It only saves work.

**A picture to hold on to: Choose a bag, and a rival picks what you get from it** (title unchanged, text unchanged)

Three bags sit on a table. You choose a bag, and then a rival, who wants you to get as little as possible, takes one thing out of it and hands it to you. To choose well you look into each bag and find its worst item, because that is the one you will be given. Then you take the bag whose worst item is best. That is minimax. Now the shortcut. Say the worst thing in the first bag is worth 4. You open the second bag and the first thing you see is worth 2. You can close that bag at once. Your rival would hand you that item or something worse, and you already have a bag that guarantees 4. Whatever else is in the second bag makes no difference.

**Where the picture stops** (unchanged)

A bag is one choice deep. A game goes many turns deep, with you and your rival choosing in turn, so each item in a bag is itself a bag, and a limit found near the top of the tree is carried down to cut branches far below. The picture also assumes your rival always picks what is worst for you. A real opponent makes mistakes, and minimax does nothing to tempt them into one. And in a large game nobody can look into every bag: the search has to stop early and estimate.

### 4. Editorial rationale

No edits. The picture is simpler than the thing it explains, which is what an analogy is for.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Q-Learning

`q-learning` · Artificial Intelligence · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The robot's notebook is a clear account of the method, and the sentence about goodness being copied back is the heart of it. The park then tells the same story at the same length: a number for each choice, high numbers spreading back from the reward, follow the biggest number. The worked example will tell it a third time, walk by walk. What the signposts can add is something the notebook cannot show: every number lives at the place where the choice is made, and nobody ever sees the whole map. The limits are strong but repeat some of what a sharper picture would say.

### 2. Repetition map

- **One number for each choice in each place.** Notebook in the Simple Explanation, signposts in the picture. Needed to set up the picture. Keep, briefly.
- **Good numbers spread back from the reward one step at a time.** Simple Explanation (best statement), picture, limits, then the worked example. Keep in the Simple Explanation. In the picture reduce to a clause. In the limits keep it once, as the reason the method is slow.
- **Occasional random steps.** Simple Explanation says it happens; the limits say why it is needed. Keep both.
- **Only the next signpost is used.** Limits only. This is the picture's real content, so it moves into the picture.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Q-learning is a way for a computer to learn what to do by trying things and seeing what happens. Nobody tells it the rules. Picture a robot in a room it has never seen. Somewhere there is a prize, and somewhere a hole it can fall into. The robot keeps a notebook. For every spot in the room, and every direction it could step from that spot, the notebook holds one number: its guess at how well things will turn out if it steps that way. At first every guess is zero. The robot wanders. When a step wins the prize, it raises the number for that step. When a step lands in the hole, it lowers it. And here is what makes it work. When a step only leads to a spot that already has a good number, part of that goodness is copied back to the step. So good numbers spread, one step at a time, from the prize back to the start. In the end the robot follows the biggest number from each spot. Now and then it still tries a random step, in case a better way exists.

**A picture to hold on to: Signposts in a park with no map** (title unchanged, text revised)

You walk in a large park with no map, looking for the café. At every junction stands a signpost with one space for each path. The only thing you may ever do is read the signpost where you have arrived, then write one number on the signpost you just left. A path that reaches the café earns a high number. A path that reaches a junction whose best number is already high earns a slightly lower one. Nobody ever sees the park from above, yet after enough walks the highest number at each junction points the way to the café.

**Where the picture stops** (revised)

A person would remember the whole walk and start to picture the map. Q-learning keeps nothing except the numbers and changes one of them per step, which is why it is slow: one walk moves what has been learned back by a single junction. The picture also hides the gamble at every junction, between following the best number and trying a path whose number is low or blank, which is the only way to find out that a signpost is wrong. And a park stays put. If the same path could lead to different places on different days, each number would have to become an average over many tries.

### 4. Editorial rationale

The picture is shorter and now has a point of its own: the method works with purely local knowledge. That is what makes Q-learning surprising, and it prepares the reader for the update rule in the worked example, which uses exactly two things, the reward and the best number at the next place. The limits keep all three of their points with the overlap removed.

### 5. Accuracy flags

"One walk moves what has been learned back by a single junction" is the source's claim and is kept. It holds for the simple setting described here (numbers starting at zero, one update per step). Some variants spread learning faster, which belongs at a later level if anywhere.

### 6. Unresolved questions

None.

---

## Kruskal's Algorithm

`kruskal` · Graph Theory · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The village story is clear and ends well on the surprise that such a short-sighted rule gives the best answer. The islands then repeat the rule step by step. Their one new idea is the landmass, which turns "can these two already reach each other?" into "are these two on the same piece of land?". That is a real step forward and deserves the whole picture. In the limits, the first point (cheapest to build is not most convenient to travel) is a fact about the result, not about the picture, and a decision-maker needs it early.

### 2. Repetition map

- **Cheapest first; build if it joins two unconnected places; skip otherwise.** Taught in the Simple Explanation. Repeated in full with bridges. Reduce to the two outcomes of the landmass question.
- **Already connected, even by a roundabout route.** Simple Explanation. The landmass says the same thing more simply and leads to union-find. Keep both; the second reframes the first.
- **Cheapest to build, not most convenient.** Limits only, where it is filed as a limit of the picture. Move to the end of the Simple Explanation.

### 3. Revised copy

**The Simple Explanation** (revised)

Kruskal's algorithm finds the cheapest way to connect a set of places so that you can get from any one of them to any other. Imagine several villages with no roads between them. An engineer has a list of roads that could be built, each with a price. The villages want everyone to be able to reach everyone else, for the least money in total. The method is short. Sort the list from the cheapest road to the most expensive. Go down the list one road at a time. If a road joins two villages that cannot yet reach each other, build it. If they can already reach each other, even by a roundabout route, skip it, because it would cost money and connect nothing new. Stop when all the villages are linked. The surprise is that this works. Always taking the cheapest useful road, with no planning ahead, gives the cheapest possible network. Cheapest to build is not the same as most convenient to travel: two neighbouring villages may end up joined only by a long way round.

**A picture to hold on to: Islands and bridges** (title unchanged, text revised)

Swap the villages for islands and the roads for bridges. At the start every island is its own landmass. Each bridge that gets built fuses two landmasses into one, so the map is always a set of landmasses that only ever merge. The question to ask of the next cheapest bridge becomes simple: are its two ends on the same landmass? If not, build it. If so, it is a waste of money, so cross it off. When only one landmass is left, you are done.

**Where the picture stops** (revised)

The picture hides how the algorithm knows whether two islands are on the same landmass. Checking that quickly, many thousands of times, needs a data structure of its own, called union-find. And real engineers can do things the list does not allow, such as building a junction in open water. The algorithm only chooses among the bridges it is given.

### 4. Editorial rationale

The picture now gives the reader a way to hold the state of the algorithm in mind: a shrinking number of landmasses. That makes the test for each bridge a question about membership, which is how the method is implemented and why the limits can point to union-find. Moving the "cheapest, not most convenient" point into the Simple Explanation puts a limit of the result where a reader deciding whether to use the method will see it.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## PageRank

`pagerank` · Graph Theory · intermediate · verdict: **light**

### 1. Overall diagnosis

A strong lesson. The Simple Explanation moves cleanly from votes, to unequal votes, to the circularity, to the way out. The random surfer is a second, independent view of the same score, and the limits are among the best on the site: they separate what readers really do, what the score is, and why the random jump exists. One problem: the Simple Explanation ends by summarising the surfer in two sentences, and the picture then begins it again from the start.

### 2. Repetition map

- **The random reader.** Introduced in the last two sentences of the Simple Explanation, then told properly in the picture. The picture's version is complete. Remove the preview.
- **Score flows from important pages.** Simple Explanation (votes that are not equal), then the picture's last sentence in the surfer's terms. The second ties the two views together. Keep.

### 3. Revised copy

**The Simple Explanation** (revised)

PageRank is a way to measure how important each page is in a web of pages that link to one another. It was created to help a search engine decide which results to show first. The idea is that a link is a kind of vote. A page that many others link to is probably worth reading. But the votes are not equal. A link from an important page counts for more than a link from a page nobody visits. That sounds like a circle: to score one page, you need the scores of the others. The way out is to start by giving every page the same score. Then let each page share its score out along its links, and repeat. After enough rounds the scores stop changing.

**A picture to hold on to: The random surfer** (title unchanged, text unchanged)

Imagine someone browsing with no purpose at all. On each page they usually click one of its links, chosen at random. Now and then, with a fixed probability, they get bored and jump to a page picked at random from the whole web. Follow this surfer for a very long time and count the visits. The share of time spent on each page is its PageRank. Pages with many links pointing at them are visited often, and so are pages linked from those.

**Where the picture stops** (unchanged)

Real readers do not click at random. They read, search, follow some links far more than others, and use bookmarks. PageRank is not a measurement of traffic. It is a score computed from the links alone, and it knows nothing about what a page says or whether it is any good. The random jump is not a claim about behaviour either. It is there for a mathematical reason: without it, dead ends and closed loops of pages would trap the surfer, and the scores would not settle to a single sensible answer.

### 4. Editorial rationale

The Simple Explanation now ends where its own argument ends, on scores that settle. The surfer arrives fresh in the picture, as the second way of seeing the score that it was meant to be, and the reader does not read the same two sentences twice within a few lines.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Critical Path Method

`critical-path` · Optimization · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation defines the idea in general terms, and the dinner gives it numbers the reader can check: 20 and 100 make 120, and nothing else comes close. That is the right division of labour. Two small things: the picture shows slack without using the word the Simple Explanation has just taught, and the last limitation is a statement about what the method is for, not about the dinner.

### 2. Repetition map

- **The longest chain sets the length.** Simple Explanation in general, picture with numbers. Keep both.
- **A late job on the chain delays everything.** Simple Explanation ("a day late"), picture ("five minutes late"). The concrete version confirms the rule. Keep.
- **Slack.** Named in the Simple Explanation, shown but not named in the picture. Add the word so the reader connects them.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The critical path method works out how long a project must take and which jobs cannot be late. A project is a set of jobs, and some jobs have to wait for others. You cannot paint a wall before it is built. Jobs that do not wait for each other can be done at the same time by different people. So a project is usually much shorter than all of its jobs added together. What matters are the chains of jobs that must happen one after another. The longest chain sets the length of the whole project. It is called the critical path. If any job on it runs a day late, the whole project ends a day late. Jobs that are not on it have spare time, called slack. They can start a little late and nothing bad happens. Knowing this tells the person in charge where to watch closely and where there is room to breathe.

**A picture to hold on to: Cooking a dinner with several dishes** (title unchanged, text revised)

A roast needs 20 minutes of preparation and then 100 minutes in the oven. The vegetables need 10 minutes of chopping and 20 minutes of cooking. A sauce takes 15 minutes. Everything should be ready together. Dinner cannot be served sooner than 120 minutes after you begin, because the two steps of the roast must follow one another and together they take that long. That chain is the critical path. The vegetables and the sauce can each be started at any moment inside a wide window, and dinner is still on time. That freedom is their slack. Start the roast five minutes late, and dinner is five minutes late.

**Where the picture stops** (revised)

One cook has two hands. The method assumes that tasks which do not wait for each other can always run at the same time, as if there were enough cooks and burners for everything. It also treats every time as known exactly, while real tasks run over.

### 4. Editorial rationale

Naming the slack in the picture costs five words and joins the example to the vocabulary. The two limitations that remain are assumptions a real kitchen breaks, so they belong with the picture. The removed sentence ("It does not say how to make the project shorter") is a point about the method's scope and sits better in "Should you use it?".

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

Does "Should you use it?" already say that the method describes a plan and does not shorten it? If not, the sentence removed from the limits should be added there, not lost.

---

## Fibonacci by Dynamic Programming

`fibonacci-dp` · Algorithms and Data Structures · beginner · verdict: **substantial**

### 1. Overall diagnosis

The first half of the Simple Explanation is excellent: the rule, the wasteful way, and the scale of the waste. Then it introduces a notebook, and the picture that follows is titled "A notebook of answers" and explains the notebook again, including the same step from writing answers down to filling the page in order. The reader meets the central image twice in a row. The opportunity is to let the Simple Explanation set up the problem and name the cure, and let the picture own the notebook.

### 2. Repetition map

- **Write each answer down once, read it back afterwards.** Simple Explanation, then the picture, in nearly the same words. Keep in the picture. In the Simple Explanation state the cure in one plain sentence.
- **Fill the page in order from the small end.** Simple Explanation ("Better still"), then the picture ("goes one step further"). Keep in the picture, as the second of two ways to use the notebook.
- **The habit generalises.** Simple Explanation's closing sentence. Said once. Keep.

### 3. Revised copy

**The Simple Explanation** (revised)

Dynamic programming is a way to stop a computer doing the same work twice. The Fibonacci numbers make a good first example. They start 0, 1, and after that each number is the sum of the two before it: 0, 1, 1, 2, 3, 5, 8, 13. Suppose you want the thirtieth one. One way is to say: I need the two numbers before it. For each of those, I need the two before them, and so on down. That works, but it asks for the same small answers again and again, millions of times in all. The cure is to work out each answer once and keep it. Then about thirty short sums are enough. The same habit, solving each small problem once and reusing the answer, speeds up many harder problems.

**A picture to hold on to: A notebook of answers** (title unchanged, text revised)

A pupil is asked the same long sum several times in one lesson. The first time, they work it out and write the answer in a notebook. Every later time, they read it off the page. The work is done once however often the question comes back. There are two ways to use the notebook. One is to write each answer down as the question comes up. The other is to know which questions are coming and work through them in order, easiest first, so that every answer needed is already on the page. For Fibonacci, that means starting from 0 and 1 and filling the page upward.

**Where the picture stops** (revised)

A notebook only helps when the same question really does come back, and when its answer cannot change between askings. It also takes up space: the page has one line for every different question.

### 4. Editorial rationale

Each section now has its own job. The Simple Explanation shows the waste and says what cures it. The picture gives the image and the two ways of using it, which are the second and third methods of the worked example. The alternative would be to keep the Simple Explanation as it was and remove the picture, but the restructure keeps the notebook, which is the lesson's best image, and tells it once. The removed limitation (large sums are slow in themselves) concerns the cost of arithmetic on very large numbers and belongs at a deeper level.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Longest Common Subsequence

`lcs` · Natural Language Processing · intermediate · verdict: **none**

### 1. Overall diagnosis

STONE and LONGEST make the definition concrete in one line, and the move from letters to document versions shows why anyone would want this. The playlists are brief and add the rule that makes the problem what it is: both listeners may skip, neither may go back. The limits then use the playlists to explain why repeated letters make the problem hard enough to need a table. Each part is short and each does its own work. No change.

### 2. Repetition map

- **What is shared is kept; the rest is removed or added.** Simple Explanation (document versions), then the picture's last sentence (songs skipped on each list). The second maps the picture onto the first. Keep.
- **Why a table is needed.** Simple Explanation says trying every crossing-out is too slow. The limits give the deeper reason: each repeated letter has many possible partners and choices block one another. Different reasons, both useful. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The longest common subsequence is the longest list of letters that appears in two pieces of text in the same order. The letters do not have to sit next to each other. Take STONE and LONGEST. Cross out letters from each word until what is left is the same in both. The most you can keep is ONE. That shared part is what the two texts have in common, and everything outside it is what changed. This is how a computer shows the difference between two versions of a document. It finds the lines that both versions share, in order, and marks the rest as removed or added. Trying every way of crossing out letters would take far too long. So the method fills in a grid. Each square answers the question for the first few letters of each word, using the answers in the squares beside it. The last square gives the answer for the whole words.

**A picture to hold on to: Two playlists with songs in common** (title unchanged, text unchanged)

Two friends each have a playlist. They want to listen together to as many songs as possible, playing them in an order that respects both lists. Each may skip songs, but neither may go backwards. The longest such run of shared songs is the longest common subsequence of the two playlists. The songs skipped on one list are deletions, and the songs skipped on the other are insertions.

**Where the picture stops** (unchanged)

A playlist rarely contains the same song twice, and without repeats the problem is easier. Text repeats letters constantly, and each copy could be paired with any copy in the other string. The choice matters, because pairing one letter rules out pairings that would cross it. That is why the table is needed. Also, there is often more than one longest common subsequence, and the algorithm reports just one of them.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Edit Distance (Levenshtein)

`edit-distance` · Natural Language Processing · intermediate · verdict: **none**

### 1. Overall diagnosis

The Simple Explanation defines the measure with one tiny example, says who uses it, and outlines the grid. It ends on a claim it does not explain: each new answer needs only three answers already in the grid. The toll grid is there to explain exactly that. It turns edits into moves, and the three ways of arriving at a corner are the three answers. The limits are short and both points come out of the picture itself. No change.

### 2. Repetition map

- **Each answer is built from three earlier ones.** Asserted in the Simple Explanation, explained by the three ways of arriving at a corner. The picture adds the reason. Keep both.
- **Sweeping across the grid.** End of the picture, then the first limitation, which says why a single sweep is enough here and would not be on a real map. The second mention adds the reason. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Edit distance measures how different two pieces of text are. It counts the fewest small changes needed to turn one into the other. A small change means adding one letter, removing one letter, or swapping one letter for another. To turn CAT into CART you add an R, so the distance is 1. Spelling checkers use this idea. When you mistype a word, they look for real words that are only a change or two away from what you typed. Finding the fewest changes sounds hard, because there are so many ways to edit a word. The method here avoids trying them all. It starts with the easiest questions, about the first letter or two of each word. Then it works up to longer and longer beginnings of the two words, writing each answer in a grid. Each new answer needs only three answers already in the grid. The last square filled in is the distance between the whole words.

**A picture to hold on to: Crossing a city grid with tolls** (title unchanged, text unchanged)

Picture a grid of streets. You start at the top-left corner and must reach the bottom-right. Moving one block down means deleting a letter. Moving one block right means inserting a letter. Both cost one coin. You can also cut diagonally across a block: that is free if the two letters at that block match, and costs one coin if they differ. The edit distance is the fewest coins for the whole trip. The cheapest way to reach any corner is the cheapest of the three ways to arrive there, from above, from the left, or diagonally, so you can work out every corner in turn by sweeping across the grid.

**Where the picture stops** (unchanged)

In this city every street is one-way: down, right, or diagonally down and right. That is why one sweep, row by row, is enough. On a real map with two-way streets you would need a method such as Dijkstra's algorithm. The picture also makes every toll one coin. Real typing errors are not all equally likely, and plain edit distance does not know that.

### 4. Editorial rationale

No edits. The picture is long for this section, but it is the first place the reader can see what the grid's numbers mean, and nothing in it is said elsewhere.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## 0/1 Knapsack

`knapsack` · Optimization · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation is one of the best on the site at explaining why the obvious approaches fail before introducing the method. The notebook then explains the step the Simple Explanation only names: what "leaving" and "taking" each look up. The limits speak to a decision-maker's real concerns. One phrase in the picture is hard to parse at the moment it matters most.

### 2. Repetition map

- **Each answer comes from two earlier answers, leave or take.** Named in the last sentence of the Simple Explanation, worked through in the picture. The first is the hand-off, the second is the teaching. Keep both.
- **A grid of smaller questions.** Simple Explanation ("first few items and a smaller bag"), then the notebook's "every bag size up to yours". The same structure, seen as a grid and then as a page. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The knapsack problem is about choosing what to take when you cannot take everything. Picture a hiker with a bag that can hold only so much weight. Each thing she could pack has a weight and a value to her. Which things should go in the bag so that the total value is as high as possible and the bag is not too heavy? Each item is either taken whole or left behind. That is what the 0/1 in the name means. One tempting plan is to grab the items that give the most value for their weight. That plan can fail, because it may leave space that nothing else fits. Trying every possible selection always works, but the number of selections doubles with each extra item. The method here is smarter. It builds a grid of small questions: what is the best I can do with only the first few items and a smaller bag? Each answer comes from two answers already in the grid, one for leaving the newest item and one for taking it.

**A picture to hold on to: A packing notebook for every bag size** (title unchanged, text revised)

Suppose you kept a notebook that says, for every bag size up to yours, the best load you could make from the items looked at so far. A new item arrives. For each bag size you now have an easy question. Leave the item, and the notebook's old answer stands. Take it, and you get its value plus the notebook's old answer for a bag that is smaller by the item's weight, which is the room left for everything else. Write down the better of the two. After the last item, the entry for your real bag is the answer.

**Where the picture stops** (unchanged)

The notebook has one line per bag size, so it only works when weights are whole numbers and the capacity is not enormous. Real packing also involves shape and volume, and real items interact: a tent is worth little without its poles. The knapsack problem assumes one number for weight, one for value, and values that simply add up.

### 4. Editorial rationale

One clause rewritten. "The smaller bag that has room for everything else" asked the reader to work out which smaller bag was meant. Saying that it is smaller by the item's weight gives them the lookup they will perform in the worked example.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Needleman-Wunsch Alignment

`needleman-wunsch` · Biology · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation carries the reader from DNA as letters, through drift over time, to scoring and the grid, without a wasted sentence. The manuscripts are a helpful anchor for readers who have never seen a gene, but most of the picture repeats the sliding and scoring just described, and it ends by restating the goal. The third limitation concerns a refinement of gap scoring that belongs further down the page.

### 2. Repetition map

- **Lay one above the other, slide, leave gaps.** Simple Explanation, then the picture. Keep one sentence in the picture; it sets the scene.
- **Matches are good, mismatches and gaps cost, best total wins.** Simple Explanation, then the picture's last three sentences. Compress to one sentence in the picture and replace the restated goal with what the manuscripts add: the arrangement is an account of what happened to the text.
- **Not guaranteed to be what actually happened.** Limits. With the picture now saying that an alignment is an account of history, this becomes the natural qualification. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Needleman-Wunsch lines up two sequences of letters so that as many letters as possible match. Biologists use it to compare DNA or proteins from different living things. DNA can be written as a long string of four letters: A, C, G and T. Over millions of years, copies of the same gene drift apart. A letter changes here. A few letters go missing there. To see what two versions still share, you write one above the other and slide parts along, leaving gaps where letters were lost. Each matching pair of letters earns points. Each mismatched pair and each gap costs points. The best line-up is the one with the highest total. There are far too many line-ups to try them all. So the method fills in a grid. It works out the best score for the first few letters of each sequence, then for a few more, until the last square holds the best score for the whole thing. Walking back through the grid shows the line-up itself.

**A picture to hold on to: Two worn copies of the same manuscript** (title unchanged, text revised)

Two scribes copied the same text by hand, generations apart. Words were changed and whole lines were dropped. To compare the copies, you lay them side by side and slide lines down, leaving a blank wherever one copy seems to have lost something. An identical pair of lines is good, a differing pair is suspicious, and a blank is a loss. The arrangement you settle on is your best account of what the copyists did. Lining up two genes is the same exercise, with letters for lines and inheritance for the scribes.

**Where the picture stops** (revised)

A scholar comparing manuscripts uses meaning and judgement. The algorithm only adds up fixed scores, and the alignment with the best score is not guaranteed to be what actually happened. It also insists on lining up both sequences from the first letter to the last. If only a passage is shared, forcing the rest into line gives a misleading picture.

### 4. Editorial rationale

The picture now ends on an idea the Simple Explanation does not contain: an alignment is a reconstruction of history, and the score is a way of choosing the most plausible one. That gives the first limitation something to qualify. The sentence on gap scoring was removed because it describes a refinement of the scoring scheme, which the reader has not yet seen in its simple form.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Binomial Option Pricing

`binomial-option-pricing` · Finance · intermediate · verdict: **light**

### 1. Overall diagnosis

The ticket is a fine plain-language account of an option, the numbers 80, 100 and 120 make the payoff concrete, and the closing caution is exactly right for a business reader. The Simple Explanation also already describes the tree and the backward pass. The trail map then describes the backward pass again. It does add two things: why working backward is easy when working forward is not, and the rule for stopping early. The first limitation, that the blend is forced and is nobody's forecast, is the most important sentence in the introduction.

### 2. Repetition map

- **Values at the ends are easy; work backwards fork by fork.** Simple Explanation, then the picture at greater length. Keep both, but cut the picture's restatement of the result and use the space for the reason backward works: each fork needs only the two numbers just beyond it.
- **The blend.** "A careful blend" in the Simple Explanation, "a number that blends" in the picture, and the limits explain that the blend is not an average and not a forecast. Three mentions that build on each other. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

An option is a ticket that lets you buy or sell something later, such as a share in a company, at a price fixed today. You may use the ticket or throw it away. Suppose a ticket lets you sell a share for 100 a year from now. If the share is then worth 80, the ticket gains you 20. If the share is worth 120, the ticket is useless and you ignore it. So what should the ticket cost today, when nobody knows the future price? This method draws a tree. From today's price the share can step up or step down. From each of those prices it can step up or down again, and so on until the last day. On the last day the ticket's worth is easy to see at every branch tip. Then you work backwards. The worth at each fork is a careful blend of the two worths that follow it. Fork by fork you arrive back at today, and the number you reach is the price of the ticket. It is the answer of a simplified model, not a promise about any real market.

**A picture to hold on to: Labelling a trail map from the ends back to the start** (title unchanged, text revised)

Imagine a trail that forks again and again, with a prize of known size at the end of every branch. You stand at the start and want to know what the walk is worth. Looking forward is confusing, because there are so many routes. Looking backward is easy. Write the prize at every trail end. Each last fork then needs only the two numbers just beyond it, blended into one. Once those forks are labelled, the forks before them have what they need, and so on back to the start. If the rules let you stop at a fork and take a fixed reward instead, compare that reward with the fork's blended number and write down the larger.

**Where the picture stops** (unchanged)

On a trail map the blend could be a plain average. In the model the blending weights are forced by the sizes of the up and down moves and by the interest rate, and they are nobody's forecast. The map also has tidy forks at fixed places. A real price can jump any distance at any moment, and every real trade costs something, both of which the model leaves out.

### 4. Editorial rationale

A light edit. The picture now says why the backward direction is easy (every fork depends only on its two successors), which the original implied but did not state, and it no longer repeats the Simple Explanation's conclusion that the number at the start is the answer.

### 5. Accuracy flags

The Simple Explanation's example is a right to sell (a put) and the worked example is a right to buy (a call). Both are correct. A reader may be briefly thrown by the switch; Words to know covers "Call and put".

### 6. Unresolved questions

None.

---

## Euclidean Algorithm

`euclidean-algorithm` · Mathematics · beginner · verdict: **none**

### 1. Overall diagnosis

The tiled floor makes the procedure visible and uses the same numbers as the worked example, so the reader meets 48 and 18 twice in two forms. The sticks look like a repeat but are not: they contain the one sentence that explains why the method is allowed to throw the larger number away ("any ruler that measures both sticks must measure that leftover piece too"). The limits are a model of the form, with one point on why the whole-number version must stop and one on division as many subtractions at once. No change.

### 2. Repetition map

- **Fit the smaller into the larger, keep the leftover, repeat.** Floor in the Simple Explanation, sticks in the picture. The floor shows what happens; the sticks say why it is valid. Keep both.
- **Stops when something fits exactly.** Both sections, then the limits explain why it must stop for whole numbers. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The Euclidean algorithm finds the largest number that divides two whole numbers exactly. That number is called their greatest common divisor. Here is a way to picture it. A floor is 48 units long and 18 units wide. You want to cover it with identical square tiles, as large as possible, without cutting any. What size should the tiles be? Start by laying the biggest squares the floor allows, 18 by 18. Two of them fit, and a strip 12 wide is left over. Now treat the strip the same way. One 12 by 12 square fits, and a smaller strip 6 wide is left. Squares of side 6 fill that last strip exactly, with nothing left. So 6 is the answer: tiles of 6 by 6 cover the whole floor. The method is more than two thousand years old. It is still in daily use, for example when computers create the keys that keep messages private.

**A picture to hold on to: Measuring two sticks against each other** (title unchanged, text unchanged)

You have a long stick and a short stick and want the longest ruler that measures both exactly. Lay the short stick along the long one as many times as it fits and mark what is left over. Any ruler that measures both sticks must measure that leftover piece too. So forget the long stick: the problem is now the short stick and the leftover. Repeat with those two. When a piece fits with nothing left over, that piece is the ruler.

**Where the picture stops** (unchanged)

With real sticks the process might never end. The side and the diagonal of a square have no common measure at all, and the leftovers get smaller forever. The algorithm is about whole numbers, where each leftover is a smaller whole number and so the process must stop. The picture also suggests laying the stick down one length at a time, which is repeated subtraction. The algorithm does all of those subtractions at once with a single division.

### 4. Editorial rationale

No edits. The two pictures are in different dimensions for a reason, and the second carries the argument.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Sieve of Eratosthenes

`sieve-of-eratosthenes` · Mathematics · beginner · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is clear and complete, and its last two sentences make a nice point about never dividing. The children in a line then perform the same procedure with the same numbers. Nothing in the picture is new. There is, though, a claim in the Simple Explanation that goes unexplained: each time, the next number still standing is prime. The children can show why. The two limitations are both costs of the method, which the picture shares, so they need to be labelled as such.

### 2. Repetition map

- **Cross out multiples of 2, then 3, then the next survivor.** Simple Explanation, then the picture, step for step. Keep the first two rounds in the picture to set the scene.
- **Whatever is left is prime.** Simple Explanation and picture. Keep, since it is the conclusion.
- **The next survivor is always prime.** Asserted in the Simple Explanation, never explained. Use the picture for this.
- **Memory for the whole range.** Limits only. A cost of the method. Keep, clearly marked as the method's cost.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The sieve of Eratosthenes finds all the prime numbers up to a limit you choose. A prime is a whole number bigger than 1 that cannot be divided evenly by anything except 1 and itself, such as 2, 3, 5 and 7. A kitchen sieve keeps what you want by letting everything else fall away, and this method does the same with numbers. Write down every number from 2 up to your limit. The first number, 2, is prime. Cross out every multiple of 2 after it: 4, 6, 8 and so on. Now move to the next number that is not crossed out. That is 3, so 3 is prime. Cross out its multiples. Keep going. Each time, the next number still standing is prime, and its multiples get crossed out. When you finish, the numbers left are exactly the primes. Nothing ever has to be divided. You only count along the list in equal steps.

**A picture to hold on to: Children sitting down in a line** (title unchanged, text revised)

Children wearing the numbers 2 to 100 stand in a line. The first child, number 2, stays standing and walks down the line asking every second child after them to sit: 4, 6, 8 and so on. Then the next child still standing, number 3, asks every third child after them to sit, and so it goes on. A child who is still standing when their turn comes has been passed over by every walker before them. Their number is not a multiple of any smaller prime, and that is enough to make it prime. When nobody new is left to take a turn, the children still standing are wearing exactly the prime numbers.

**Where the picture stops** (revised)

This picture is close to exact, so its weak points are the method's own. Some children are asked to sit more than once: number 12 hears it from 2 and again from 3. The computer wastes effort in the same way, and it is the main inefficiency of the method. There must also be one child for every number up to the limit. That is the real cost of the sieve: memory for the whole range. It is fine for a limit of a hundred or a hundred million, and impossible for numbers with hundreds of digits.

### 4. Editorial rationale

The picture now answers the question a thoughtful reader will have: how do we know the next one standing is prime, without testing it? Being passed over by every earlier walker is the test. The limits keep both of their points, with an opening sentence that tells the reader these are costs of the sieve itself and not places where the children mislead.

### 5. Accuracy flags

The revised picture relies on the fact that a whole number above 1 with no smaller prime dividing it is itself prime. This is standard and true, but it is a new sentence in the lesson and should be checked against the level 3 proof for consistent wording.

### 6. Unresolved questions

None.

---

## Fast Modular Exponentiation

`modular-exponentiation` · Mathematics · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation separates the method into two ideas and gives each a sentence of proof by example. It leaves one thing vague on purpose: how to mix squarings and multiplications to land on an exact count. The copier explains that, with the same number 13 the worked example uses, and reads the recipe off the binary digits. The limits do the mapping from sheets to multiplications and restore the half of the method the copier leaves out. The structure needs no change. One count in the picture does not match its own steps.

### 2. Repetition map

- **Squaring doubles the count.** Simple Explanation (2, 4, 8, 16), then the copier's double button. The copier turns the fact into a procedure. Keep.
- **Take the remainder at every step.** Simple Explanation, then the limits, which note that the picture omits it. A necessary reminder. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Fast modular exponentiation finds the remainder of a huge power without ever working out the huge power. Suppose you multiply 1,000 sevens together and want the remainder when the result is divided by 13. The full product has more than 800 digits. You do not need it. Two ideas get the answer using small numbers only. First, you may take the remainder after every multiplication and carry on from there. The final remainder comes out the same, and no number ever grows beyond 13 times 13. Second, you do not need 1,000 multiplications. Squaring a result doubles the count of sevens multiplied into it: 2, then 4, then 8, then 16. By mixing squarings with a few extra multiplications by 7, you can land on exactly 1,000 in fewer than twenty steps. The encryption that protects messages and payments online depends on this, using numbers hundreds of digits long.

**A picture to hold on to: A copier that can only double** (title unchanged, text revised)

You need a stack of exactly 13 sheets. Your machine has two buttons. One doubles the whole stack. The other adds a single sheet. Starting from 1 sheet: double and add one to get 3, double to get 6, double and add one to get 13. Three doublings, with an extra sheet twice, instead of adding one sheet twelve times. Which steps get the extra sheet is not a guess. It is read off 13 written in binary, 1101: after the leading 1, each digit means "double", and each 1 means "then add one".

**Where the picture stops** (unchanged)

The stack counts how many copies of the base have been multiplied together, which is the exponent, not the value of the power. Doubling the stack corresponds to squaring the running result, and adding a sheet corresponds to multiplying by the base once. The picture also leaves out the other half of the method: taking the remainder after every step, which is what keeps the numbers small.

### 4. Editorial rationale

One word changed, for accuracy. The steps listed (1 to 3, 3 to 6, 6 to 13) contain three doublings, and the binary rule that follows also gives three (one for each digit after the leading 1). The original said four.

### 5. Accuracy flags

"Four steps of doubling" in the original picture does not match the three doublings it lists. The revision says three. The lesson's summary and takeaway say "square for every digit", which gives four squarings for 1101 when the running result starts at 1. Both conventions are valid, but the picture starts from 1 sheet and so uses three. Please confirm the picture and the level 2 mechanics describe the same convention.

### 6. Unresolved questions

None.

---

## Bisection Method

`bisection-method` · Mathematics · beginner · verdict: **substantial**

### 1. Overall diagnosis

The shower dial is an ideal example and the Simple Explanation uses it fully: the halving, the numbers for ten and twenty tries, and the guarantee. The picture is then the same dial, with the same halving, under a title that says so. Nothing new is offered. The opportunity is the step the introduction never takes: from a dial to an equation. The worked example opens with "too low" and "too high" values of an expression, and nothing has yet told the reader that these are the hot and cold of the shower.

### 2. Repetition map

- **Test the halfway setting and keep the half that holds the answer.** Taught in the Simple Explanation. Repeated in full in the picture. Remove from the picture.
- **Each test halves what is in question.** Simple Explanation, with numbers. Repeated in the picture's last sentence. Remove.
- **Only the direction of the error is used.** Implicit in the Simple Explanation, stated in the limits ("looks only at the sign"). The word "sign" has no meaning for a shower until the dial has numbers on it. The revised picture provides them.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The bisection method finds the exact spot where something changes from too little to too much. Think of a shower dial. At one setting the water is too cold. At another setting it is too hot. Somewhere between the two is the setting that is just right. So you try the setting exactly halfway between. If the water is still too cold, the right setting must be in the upper half. If it is too hot, the right setting must be in the lower half. Either way, the gap you have to search is now half as wide. Try the middle of that gap, and halve it again. After ten tries the gap is about a thousand times narrower than at the start. After twenty tries it is a million times narrower. Computers use this to solve equations that no formula can solve. It is not the fastest method, but it is the safest. As long as the thing being measured changes smoothly, the answer can never slip out of the gap.

**A picture to hold on to: Putting numbers on the dial** (title changed, text revised)

Attach a number to each setting of the shower dial: how far the water is from comfortable. The number is below zero when the water is too cold, above zero when it is too hot, and exactly zero when it is right. Now the search has a precise form. You hold two settings, one where the number is negative and one where it is positive, and you want the setting where it is zero. The number at the halfway mark is negative or positive, and that sign alone says which half to keep. An equation is solved the same way. The unknown takes the place of the dial, and the expression that should equal zero takes the place of the comfort reading.

**Where the picture stops** (revised)

A person at a shower uses more than "too hot" or "too cold". If the water is only slightly too cold, they nudge the dial a little instead of going to the halfway mark. Bisection ignores how far off the midpoint is and looks only at the sign, which is why faster methods exist. The dial also has one right setting, while the quantity in an equation can cross zero several times inside the gap. Bisection then finds one of the crossings and says nothing about the others.

### 4. Editorial rationale

The picture no longer repeats the Simple Explanation. It builds the bridge from the everyday example to the mathematical one, so that the worked example on the square root of 2 reads as the shower again and not as a new topic. It also gives meaning to "sign" before the limits use the word. In the limits, "a function ... inside a bracket" became "the quantity in an equation ... inside the gap" to match the words the reader has met so far.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Newton's Method

`newtons-method` · Mathematics · intermediate · verdict: **light**

### 1. Overall diagnosis

The oven dial is an original and effective way to teach Newton's method as arithmetic: how far off, how fast things change, divide. The plank gives the same method as geometry, which is a different view and worth having. The join between them is missing. The picture opens with "Stand on the curve" and the reader, who has been thinking about an oven, has not been told what curve. The limits are good and use "root", which has not been introduced.

### 2. Repetition map

- **Use the local rate of change to choose the correction.** Simple Explanation as arithmetic, picture as a straight plank. Two views of one step. Keep both and say that they are the same thing.
- **It works best when close; a poor start can mislead.** Simple Explanation ends on the catch. The limits show why, with the plank pointing somewhere worse. The second explains the first. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Newton's method solves an equation by making a guess and then improving it, quickly. Suppose you want an oven at exactly 200 degrees, and the dial has no numbers. You pick a position and wait. The oven settles at 180 degrees, which is 20 too low. You also know that, around this position, one notch of the dial adds about 10 degrees. So you turn it up 2 notches. That would be perfect if every notch added exactly 10 degrees. Real dials are not that regular, so you might land on 199. You measure again and make a much smaller correction. Each round uses two facts: how far off you are, and how quickly the result changes when the guess changes. Dividing the first by the second gives the correction. Once the guess is close, every round roughly doubles the number of correct digits, so a few rounds are enough. The catch is that a poor first guess can send the method the wrong way.

**A picture to hold on to: A straight ramp laid along the curve** (title unchanged, text revised)

Draw the problem as a curve. Along the ground are your possible guesses, and the height of the curve above or below each guess shows how far off it is. The answer is where the curve meets ground level. Stand on the curve at your current guess. Lay a long straight plank so that it touches the curve under your feet and points the way the curve is heading. Walk along the plank to the point where it reaches ground level. Then step straight up or down onto the curve again and lay a new plank. The plank is the oven-setter's assumption that the rate measured here holds all the way. If the curve is nearly straight between you and the answer, the first plank almost gets you there, and the second is aimed from much closer.

**Where the picture stops** (revised)

A plank is straight and the curve is not. If the curve bends sharply between where you stand and the answer, the plank can point to a place farther away than where you started. If the curve is level under your feet, the plank is level too and never reaches the ground. And the picture hides the price: to lay the plank you must know the slope, which means having a formula for the derivative or computing an estimate of it.

### 4. Editorial rationale

Two additions, both connective. The opening sentences tell the reader what the curve is before asking them to stand on it. The sentence about the oven-setter ties the plank to the assumption the Simple Explanation already made ("that would be perfect if every notch added exactly 10 degrees"), so the reader sees one method from two sides and not two methods. "Root" became "answer" in both sections because the term is defined later.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Euler's Method

`euler-method` · Physics · beginner · verdict: **none**

### 1. Overall diagnosis

The cooling tea teaches the step in one dimension. The ship puts the same step on a chart, where the reader can see the approximation: straight segments standing in for a curved path. The limits are excellent. Both name a real difference between a navigator and the method, and the first (the ship's instruments read the real ship, the method reads its own estimate) is the deepest idea in the introduction. No change.

### 2. Repetition map

- **Assume the current rate holds for one step, then measure again.** Tea in the Simple Explanation, ship in the picture. The second adds the picture of the error as the gap between a chain of segments and a curve. Keep both.
- **Errors accumulate.** Simple Explanation ("can go badly wrong"), then the limits, which explain how errors feed on themselves. The second gives the mechanism. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Euler's method predicts the future one small step at a time. Suppose you know two things about a cup of hot tea: how warm it is now, and how fast it is cooling at this moment. What will its temperature be in one minute? A simple guess is to pretend the cooling rate stays the same for that minute. Multiply the rate by one minute and take that much off. Now you have a new temperature. Cooler tea cools more slowly, so you work out the new rate and repeat for the next minute. Step by step, you trace out the whole future of the tea. Many things in nature are like this. We know the rule for how fast they change, but there is no formula for where they end up. Planets, populations and electric circuits are examples. The smaller the steps, the closer the prediction stays to the truth, and the more steps it takes. With steps that are too big, the prediction can go badly wrong.

**A picture to hold on to: Navigating with only a compass and a speedometer** (title unchanged, text unchanged)

A ship out of sight of land cannot see where it is. The navigator knows the last marked position, the heading and the speed. So for the next hour the navigator draws a straight line on the chart in that direction, as long as the distance the ship would cover in an hour, and marks a new position at its end. Then the instruments are read again and the next line is drawn. The plotted course is a chain of straight segments standing in for the curved path of the real ship.

**Where the picture stops** (unchanged)

The ship's instruments measure the real ship, wherever it truly is. Euler's method computes the rate of change from its own estimated position. Once the estimate has drifted, the rates it uses belong to the wrong place, so errors can feed on themselves. A navigator also sights land sooner or later and corrects the chart. Euler's method never receives a correction: every error it makes is carried forward to the end.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Runge-Kutta (RK4)

`runge-kutta-4` · Physics · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation sets out the four readings carefully and is honest about the trade: four times the work per step, far fewer steps. The navigator then describes the four readings again in the same order. What the navigator adds is the idea of a trial: lines drawn to gather information and never sailed. That idea is only implied, and it is the thing learners most often miss about this method. The limits are strong, and the first depends on exactly this point.

### 2. Repetition map

- **Four readings: start, middle, middle again, end.** Simple Explanation, then the picture. Keep the list in the Simple Explanation. In the picture keep it compressed and put the weight on what the readings are: trials.
- **The two middle readings count most.** Simple Explanation, picture, and limits (weights fixed by algebra). The first states it, the third says where the weights come from. The picture's mention can stay as a clause.
- **No outside correction.** Limits, echoing the Euler lesson. Brief and true. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Runge-Kutta is a careful way to predict the future one step at a time. Suppose you want to know where a rolling ball will be one second from now. The quick way is to check its speed now and pretend that speed holds for the whole second. But the ball may be slowing down, so the quick guess goes too far. The careful way takes four readings of the speed instead of one. The first is the speed right now. The second is the speed the ball would have half a second from now, if the first reading were right. The third is the speed at the half second again, using the second reading to get there. The fourth is the speed at the end of the second. Then the method averages the four, counting the two middle readings twice, and moves the ball by that average. Each step is four times the work. In return the answer is so much more accurate that far fewer steps are needed.

**A picture to hold on to: A navigator who checks the water ahead** (title unchanged, text revised)

A navigator plotting the next hour could draw one straight line using the current heading and speed. A more careful navigator treats that line as a trial. What would the wind and current be half an hour along it? Redraw using those, check the half-hour point again along the corrected line, then check the full-hour point. None of the trial lines is sailed. They exist to collect readings, and the course finally drawn blends all four, giving most weight to the two taken at the middle of the hour.

**Where the picture stops** (unchanged)

A real navigator cannot measure the sea at a place the ship has not reached. The method can make its trial readings only because the rule of change is a formula that can be evaluated for any time and any state, including states the system never visits. The weights are also not a navigator's judgement: they are fixed by algebra so that the errors of the four readings cancel as far as possible. And like Euler's method, RK4 never receives a correction from outside, so whatever error it makes is carried forward.

### 4. Editorial rationale

The picture is the same length and the same scene. The change is in emphasis: it now says outright that the intermediate lines are trials, which gives the reader the right way to think about the middle readings before the worked example calls them trial points. It also prepares the first limitation, which explains why the method can take trial readings when a real navigator could not.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Fast Fourier Transform

`fft` · Mathematics · advanced · verdict: **substantial**

### 1. Overall diagnosis

The chord is the right example and the Simple Explanation uses it well, then gives an honest outline of what makes the fast version fast. The picture is the same chord and the same ear, saying the same thing: one combined wave goes in, a list of pitches and strengths comes out. The reader gets nothing new from it. The limits are accurate but run to three technical points, the last of which (frequencies above half the sampling rate) is about sampling and uses a term the reader has not met.

### 2. Repetition map

- **One combined wave; the ear picks out the notes; the transform does the same with numbers.** Simple Explanation, then the whole of the picture. Keep in the Simple Explanation. In the picture keep one sentence and move on.
- **The output is a list: how much of each pitch.** Simple Explanation ("a lot of this note, some of that one, none of the others"), then the picture's last sentence. Keep once.
- **Checking the recording against each pitch.** Mentioned in the Simple Explanation as "the plain way", not explained. The picture's own phrase, "the ear responds to each pitch on its own", is the seed of an explanation. Build the picture on it.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A Fourier transform takes a mixed-up signal and tells you what simple ingredients it is made of. Think of a chord on a piano. Three keys are pressed together, and the three notes travel through the air as one wobbling wave. A microphone records only that one combined wave. Yet your ear can tell that three notes are in it. A Fourier transform does the same job with arithmetic. It takes the recorded wave and reports how much of each pitch it contains: a lot of this note, some of that one, none of the others. The fast Fourier transform, or FFT, is a quick way to do that arithmetic. The plain way checks the recording against every possible pitch, one at a time, which is slow. The FFT splits the recording into halves again and again, and reuses the work that different pitches have in common. For a recording of about a thousand numbers, that is roughly two hundred times less work. That speed is why phones, audio software and medical scanners can use it constantly.

**A picture to hold on to: Hearing the notes in a chord** (title unchanged, text revised)

Nothing in the chord's combined wave is labelled with the names of the notes. A listener hears them anyway, because the ear responds to each pitch on its own. Picture a row of detectors, each tuned to a single pitch. Play the chord and three of them answer, each as strongly as its note is loud, while the rest stay quiet. A Fourier transform is that row of detectors done with numbers: one test for each pitch, and one answer from each, saying how much of that pitch is in the wave.

**Where the picture stops** (revised)

The ear listens continuously and judges pitch on its own scale. The FFT looks at one fixed block of samples and can only report on a fixed ladder of frequencies: 0, 1, 2, 3 and so on whole cycles per block. A note that falls between two rungs is smeared across several of them. The FFT also describes the block as a whole, so it cannot say when within the block a note began or ended.

### 4. Editorial rationale

The picture now explains what the Simple Explanation means by checking the recording against every pitch, one at a time: a separate test for each pitch, each giving one number. That is the question the worked example asks ("how much of each pattern is in the signal?"), and it makes the fixed ladder of frequencies in the limits easy to accept, since a row of detectors has a fixed set of tunings. The limitation about half the sampling rate was removed from the introduction because it is a fact about how the signal was measured and needs a term defined later.

### 5. Accuracy flags

1. "Roughly two hundred times less work" for about a thousand numbers depends on how operations are counted (about a hundred times if the fast method is counted as n log n, about two hundred if counted as half that). Confirm it matches the counts published on the Verification page.
2. The row of detectors in the revised picture is offered as a picture, built on the original's "the ear responds to each pitch on its own". It should not be read as a claim about anatomy.
3. The removed limitation (frequencies above half the sampling rate appear as lower ones) is correct and should be kept at a later level if it is not already there.

### 6. Unresolved questions

None.

---

## Gradient Descent

`gradient-descent` · Optimization · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The foggy hillside is the classic picture for this method and the Simple Explanation tells it well, ending on a good plain account of what "learning" means. The picture then begins with the same hillside in nearly the same sentences. Its only new content is the stride length. The limits then repeat the stride's danger a third time before reaching two points that matter. The opportunity is to keep in the picture only what the Simple Explanation left out.

### 2. Repetition map

- **Fog, slope under your feet, step downhill, repeat.** Simple Explanation, then the first three sentences of the picture, almost word for word. Remove from the picture.
- **Long strides overshoot the valley.** Picture, then the first limitation. Keep in the picture. In the limits keep only the reason a hiker would not make the same mistake.
- **Stuck in a small dip.** Limits only. A weakness of the method that the hiker shares. Essential. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Gradient descent is a way to find the lowest point of something when you cannot see all of it. Imagine standing on a hillside in thick fog. You want to reach the bottom of the valley. You cannot see the valley, but you can feel which way the ground slopes under your feet. So you take a small step downhill. Then you feel the slope again and take another step. Keep going, and you end up somewhere low. Computers use the same trick with numbers. They start with a guess. They measure how wrong the guess is, and work out which small change would make it less wrong. They make that change, then repeat, often millions of times. This is what people mean when they say a computer program is learning: each step makes its answers a little less wrong.

**A picture to hold on to: The steepest way down, and the length of your stride** (title changed, text revised)

Two things about the foggy hillside still need saying. First, of all the directions that lead down, you step in the steepest one. Second, the length of your stride matters. Tiny strides are safe but slow. Giant strides can carry you clear across the valley and up the other side. In the algorithm the stride length is a number you choose, called the learning rate.

**Where the picture stops** (revised)

A hiker moves smoothly and would feel the ground begin to rise. The algorithm jumps from point to point and finds out where it has landed only afterwards. A hillside also has only two directions to move in, while the problems solved in machine learning have millions of directions at once. And fog or no fog, a hiker who reaches a small dip may be nowhere near the deepest valley. The algorithm has the same weakness.

### 4. Editorial rationale

The picture is now shorter and entirely new to the reader: the direction is the steepest one, and the stride is a setting with a name. Those are the two things the worked example uses (the slope and the learning rate). The first limitation no longer repeats the overshoot. It explains why a walker would not overshoot and the algorithm can.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Simulated Annealing

`simulated-annealing` · Optimization · intermediate · verdict: **none**

### 1. Overall diagnosis

The hiker who sometimes walks uphill explains the rule. The marble on a shaken tray explains why the rule finds deep places: there is a stage where the shaking can still empty a shallow dent but not a deep one. That sentence is the insight of the method and the Simple Explanation does not contain it. The limits name one real difference from a marble, correct an over-optimistic reading of the tray, and then make the most useful point for anyone applying the method: often there is no surface, only arrangements and small changes. No change.

### 2. Repetition map

- **Only going downhill gets stuck in the first dip.** Hiker in the Simple Explanation, still tray in the picture. Each story needs it to set up its own remedy. Keep both.
- **Loose at first, strict later.** "Say yes less and less" in the Simple Explanation, gentler shaking in the picture. The picture adds what the loosening achieves at each stage. Keep both.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Simulated annealing is a way to search for the best answer when there are far too many possibilities to check them all. Picture a hiker in thick fog who wants the lowest point in a range of hills. A hiker who only ever walks downhill stops in the first dip they reach. A much deeper valley may lie just over the next ridge, and they will never see it. Simulated annealing lets the hiker walk uphill now and then. At each step the hiker picks a random spot nearby. If it is lower, they go there. If it is higher, they might still go, by chance. Early on they say yes to uphill steps often, so they roam widely and climb out of shallow dips. As time passes they grow stricter and say yes less and less. By the end they only walk downhill and settle into the low place they have found. The name comes from annealing: heating a metal and cooling it slowly, so that its atoms settle into an orderly pattern.

**A picture to hold on to: A marble on a shaken tray** (title unchanged, text unchanged)

Picture a tray moulded with many dents of different depths, and a marble that you want in the deepest dent without looking. If you hold the tray still, the marble rolls into the nearest dent and stays there. So you shake the tray. Hard shaking throws the marble out of any dent, shallow or deep. Then you shake more and more gently. There comes a stage where the shaking can still knock the marble out of a shallow dent but not out of a deep one, so the marble tends to collect in a deep one. When the shaking stops it rests there. The strength of the shaking is the temperature.

**Where the picture stops** (unchanged)

A real marble rolls smoothly and carries momentum. The algorithm has neither: it proposes a jump, then accepts or refuses it by a rule of chance. The tray also suggests that patience always wins the deepest dent, and that is not true. With any cooling schedule fast enough to be practical, the search often ends in a good dent that is not the best one. And many real uses have no surface at all. The position is an arrangement, such as the order in which to visit cities, and a nearby point is the same arrangement with one small change.

### 4. Editorial rationale

No edits. Two images in one introduction is usually one too many, but here the second explains something the first cannot.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Genetic Algorithm

`genetic-algorithm` · Optimization · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation opens with a breeder of horses, then describes the algorithm clearly in its own terms. The picture is a breeder again, with wheat for horses, telling the same story more fully. The limits are among the most honest on the site about how little the algorithm really shares with biology. The breeder is the right picture. The reader meets it twice in a row, once as three sentences about horses and once as the wheat field.

### 2. Repetition map

- **A breeder does not design the result; they breed from the best.** Simple Explanation (horses, three sentences), then the picture (wheat, in full). Keep the full telling in the picture. In the Simple Explanation keep the comparison as a single clause.
- **Select, blend, change a little at random.** Simple Explanation in the algorithm's terms, picture in the breeder's. One telling on each side of the comparison is what lets the reader map them. Keep both.
- **Only a way of comparing is needed.** Simple Explanation ("a way to tell a better guess from a worse one"), then the picture ("they only compare plants"). The central idea, once in each language. Keep.

### 3. Revised copy

**The Simple Explanation** (revised)

A genetic algorithm searches for a good answer in the way a breeder improves animals or crops: by breeding from the best of each generation, not by designing the result. It starts with a crowd of random guesses at the answer to a problem. It scores every guess to see how good it is. Then it builds a new crowd. Good guesses are picked more often to be parents. Two parents are blended to make a child that takes after both. Now and then a child is changed a little at random, which brings in something new. The new crowd replaces the old one, and the cycle repeats. Over many rounds the crowd drifts toward better answers. Nobody tells it how to improve. It only needs a way to tell a better guess from a worse one. It does not promise the best answer, only a good one.

**A picture to hold on to: Selective breeding** (title unchanged, text unchanged)

A plant breeder wants wheat that survives drought. Each season they grow a field of plants, see which ones cope best, and keep seed mostly from those. They cross promising plants with each other, hoping a child inherits the strengths of both. Now and then a seed carries a small accidental change, and once in a while that change helps. The breeder never works out what a drought-proof plant should look like. They only compare plants and decide which ones get to have offspring. After enough seasons the field looks very different from the first one.

**Where the picture stops** (unchanged)

The algorithm borrows three ideas from breeding and almost nothing else. Real inheritance works through genes in ways far more intricate than averaging two numbers. A breeder's field holds thousands of plants and takes a year per generation, while the algorithm uses a few dozen candidates and judges each by one fixed score. Natural evolution has no score and no goal at all. So a genetic algorithm is not a simulation of evolution, and nothing about biology guarantees that it will work on a given problem.

### 4. Editorial rationale

The breeder's story is now told once, in the picture, in the author's words. The Simple Explanation keeps the comparison in its opening sentence so the reader knows where the idea comes from, then spends its length on the algorithm. The cost is the line about not designing a horse. The picture makes the same point about wheat ("the breeder never works out what a drought-proof plant should look like"), so nothing is lost but the horse.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Simplex Method

`simplex` · Optimization · advanced · verdict: **none**

### 1. Overall diagnosis

The bakery turns a planning problem into a shape with corners, and the Simple Explanation states the key fact plainly: if there is a best plan, a corner is one. It does not say why. The sloping field supplies the reason in two moves (walk uphill until a fence stops you, then along the fence until a post does), which is as close to a proof as a first-level reader needs. The limits then say what cannot be pictured and, most important for a business reader, what happens when the slope is not even. No change.

### 2. Repetition map

- **The best point is at a corner.** Asserted in the Simple Explanation, argued in the picture. Keep both.
- **Walk from corner to corner while things improve.** Simple Explanation, then the last four sentences of the picture. The repeat is short and completes the picture. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

The simplex method finds the best mix of things to make when several limits apply at once. Picture a bakery that sells bread and cakes. Cakes earn more money. But there are only so many cake tins, so much oven space and so many hours in the day. Every possible plan is a point on a map: so much bread across, so many cakes up. Each limit rules out part of the map with a straight line. What is left is a shape with flat sides and corners. Here is the key fact. If there is a best plan, one of the corners is a best plan. So there is no need to check the endless points inside the shape. The method starts at the corner where nothing is made. It looks along the edges that leave that corner and follows one that raises the profit. At the next corner it does the same again. When no edge leads to more profit, it stops. That corner is the best plan.

**A picture to hold on to: Walking the fence of a sloping field** (title unchanged, text unchanged)

A farmer's field lies on an even slope and is fenced with straight runs of fence. You want to stand at its highest point. Because the ground slopes evenly, the highest point cannot be in the middle of the field or partway along a fence: wherever you stand, you could go a little higher by walking uphill until a fence stops you, and then along that fence until a post stops you. So the highest point is at a fence post. Start at any post. Two fences leave it. If one of them climbs, follow it to the next post. Repeat. When both fences at your post lead downhill, you are at the top.

**Where the picture stops** (unchanged)

A field has two directions and each post has two fences. A real problem with a thousand products is a shape in a thousand dimensions, with far more corners than could ever be listed and many edges at each one. Nobody can picture that shape, and the method never does: it works on a table of numbers, and the walk is only a way to understand what the table is doing. The slope must also be perfectly even. If the profit per item changes with the amount made, the best point need not be at a corner at all.

### 4. Editorial rationale

No edits. The picture is long, and every sentence is either the argument or the walk.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Stochastic Gradient Descent

`stochastic-gradient-descent` · Optimization · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation puts the idea in its real setting (a million house sales) and explains the surprising part well: rough answers that are off in different directions cancel, while the improvements add up. The baker restates that in an everyday setting. The restatement is long, but the baker also brings two things the house prices do not: the cost of asking everyone, in weeks, and the choice of how many to ask. The limits are excellent, especially the point about the early morning crowd. A small edit makes the picture's own contribution easier to see.

### 2. Repetition map

- **A small random sample gives a rough answer; the roughness cancels over many steps.** Simple Explanation, then the picture. This is the idea the whole method rests on and the one readers find hardest to believe, so a second telling in a familiar setting is justified. Tighten it to one sentence in the picture.
- **Batch size is a trade.** Picture only (ten people or a hundred). New. Mark it as a choice.
- **The sample must be random.** "Picked at random" in both sections; the limits say what goes wrong otherwise. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Stochastic gradient descent is how a computer learns from a mountain of examples without looking at all of them before every move. Suppose a program should guess a house's price from its size, and it has a million past sales to learn from. It starts with a bad guessing rule. To improve the rule, it could check it against all million sales, work out the best small change, and make it. That is slow: a million checks for one small change. So it does something quicker. It picks a handful of sales at random, checks the rule on only those, and makes the small change they suggest. Then it picks another handful and does it again. Each handful gives a rough answer, a bit off in some random direction. But the handfuls are off in different directions, so over many steps the errors mostly cancel while the improvements add up. The word stochastic means random: chance decides which examples are used at each step.

**A picture to hold on to: Asking ten customers instead of the whole town** (title unchanged, text revised)

A baker wants to know whether the town would like the bread saltier or sweeter. Asking all 20,000 townspeople would give a reliable answer, once, after weeks. Instead the baker asks ten customers picked at random, changes the recipe slightly in the direction they favour, and asks ten different customers the next day. Any ten people can be unusual, so on some days the recipe moves the wrong way, but the unusual groups pull in different directions, and the recipe drifts toward what the town as a whole prefers. How many to ask is a choice. A hundred people each day give a steadier answer, but every day then costs ten times as much.

**Where the picture stops** (unchanged)

The baker adjusts one thing. A model has many adjustable numbers, and each batch gives a direction for all of them at once. The baker could also stop when the customers seem content, but the batches in this method never agree: even at the best recipe, each small group still asks for some change, so the recipe keeps jittering unless the changes are made smaller over time. Last, the picture only works if the ten are chosen at random. A baker who only asks the early morning crowd ends up with bread for early risers, and a program that forgets to shuffle its data makes the same mistake.

### 4. Editorial rationale

The cancelling is now one sentence, which is enough for a point the reader has just met, and the batch-size trade is introduced as a decision the user of the method has to make. Nothing else needed changing.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Adam Optimizer

`adam` · Optimization · advanced · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is a careful piece of teaching. It shows the plain walker failing in a narrow valley, then introduces two kinds of memory and says what each does to the side-to-side and along-the-valley slopes. The picture is the same walker in the same fog with the same two memories, now called notebooks, at two thirds of the length. Only its last sentence is new: the walker ends up covering ground at a similar pace in both directions. That is an important consequence and it is not explained. The limits include a subtle and correct warning about diagonal valleys, and end by repeating the Simple Explanation's closing sentence.

### 2. Repetition map

- **The first memory averages recent slopes, so flips cancel and steady slopes build.** Simple Explanation (best version), then the picture. Reduce to a clause in the picture.
- **The second memory tracks typical slope size per direction, and the step is divided by it.** Simple Explanation, then the picture. Keep one sentence in the picture, because the new point depends on it.
- **Steep directions get shorter steps, gentle ones longer.** Simple Explanation, then the picture. Replace with the consequence: the strides come out about equal.
- **Millions of directions, not two.** Last sentence of the Simple Explanation and last sentence of the limits. Remove from the limits.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Adam is a recipe for walking downhill when you can only feel the slope under your feet. Picture a hiker in fog, in a long, narrow valley. A plain walker takes big steps where the ground is steep and tiny steps where it is nearly flat. That goes badly here. The steep side walls throw the walker from side to side, while the gentle slope along the valley floor, the way that matters, earns only tiny steps. Adam adds two kinds of memory. First, it remembers which way the slope has pointed lately and steps in that averaged direction. Side-to-side slopes keep flipping, so they cancel. The slope along the valley keeps pointing the same way, so it adds up. Second, it keeps a separate memory for north-south and for east-west of how big the slopes have usually been, and divides by it. A direction with huge slopes gets its steps shrunk. A direction with tiny slopes gets its steps stretched. Computers use this recipe to train neural networks, which have millions of adjustable numbers instead of two directions.

**A picture to hold on to: The fog walker's two notebooks** (title changed, text revised)

Give the fog walker a notebook for each kind of memory. One holds the running average of recent slopes, which sets the direction. The other holds, separately for north-south and for east-west, how large the slopes have typically been, and the walker divides by it before stepping. Notice what that division does. On steep ground a large slope is divided by a large number. On gentle ground a small slope is divided by a small number. Either way the stride comes out about the same length. The walker covers ground at a similar pace in both directions, whatever the steepness.

**Where the picture stops** (revised)

No real walker can stride one length north-south and a different length east-west at the same moment. Adam can, because it treats every adjustable number on its own. That is also where the picture gives a warning: the adjustment works along the compass directions only. If the valley runs diagonally, both compass directions see the same mixture of steep and gentle slopes, and the separate strides help much less. The memory has a cost too. Carried by its averaged direction, the walker goes past the lowest point and has to turn back.

### 4. Editorial rationale

The picture no longer re-teaches the two memories. It takes them as read and draws out what the second one achieves: step length stops depending on how steep the ground is. That is the idea behind the worked example, where one direction is a hundred times steeper than the other. The title was shortened from a full sentence to a name.

### 5. Accuracy flags

"Either way the stride comes out about the same length" expands the original's "covers ground at a similar pace in both directions". It is true as a rough description of Adam's behaviour once its averages have settled. Please check that it does not overstate what the level 2 mechanics show.

### 6. Unresolved questions

None.

---

## Linear Regression

`linear-regression` · Machine Learning · beginner · verdict: **light**

### 1. Overall diagnosis

A very good pairing. The Simple Explanation defines the best line and how a computer finds it. The springs explain something the definition leaves as a bare rule: why the gaps are squared, and what that does. The limits are thoughtful. One of the three, the far-away pin that drags the rod, is not a place where the picture stops. It is the picture succeeding, and the text says as much ("explains a weakness as well as a strength").

### 2. Repetition map

- **Squared gaps.** The Simple Explanation gives the rule and a reason (big misses count for a lot). The springs give a physical reason. The picture's last clause repeats the square once more, which helps the mapping. Keep.
- **The best line has the smallest total.** Simple Explanation, then "least total energy". The same statement in two languages, needed for the mapping. Keep, and tell the reader it is the same line.
- **One far-off point pulls the line.** Limits only. Move into the picture.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Linear regression is a way to draw the best straight line through a scatter of dots. Suppose you write down how tall each of your classmates is and how big their shoes are. Put one dot on a chart for every person. The dots form a rough, sloping cloud, because taller people tend to have bigger feet. No straight line passes through every dot, so which line is the best one? The usual answer goes like this. For each dot, measure how far above or below the line it sits. Multiply each of those gaps by itself, so that big misses count for a lot. Then add them all up. The best line is the one with the smallest total. A computer can find it by starting with any line and nudging it, a little at a time, in whichever way makes the total smaller. Once you have the line, you can use it to make a sensible guess about someone new. Give it a height, and it reads off a shoe size.

**A picture to hold on to: A rod held by springs** (title unchanged, text revised)

Pin every data point to the chart. Attach a spring from each pin straight up or down to a stiff rod, and let go. Each spring pulls the rod toward its own pin, and a spring stretched twice as far stores four times the energy. The rod swings and slides until the pulls balance. That resting position is the best line described above, known as the least squares line: it is the position with the least total energy in the springs, and spring energy grows with the square of the stretch. The springs also show the method's weak spot. One pin placed far from the others stretches its spring so much that it drags the whole rod toward itself.

**Where the picture stops** (revised)

The springs in this picture can only stretch straight up and down, which no real spring would do without a guide rail. The method measures vertical gaps on purpose, because it is predicting y from x. And the rod settles somewhere even when the pins follow a curve, so a resting position is no evidence that a straight line was the right shape to use.

### 4. Editorial rationale

The outlier sentence moved from the limits to the picture because it is something the springs teach, not something they get wrong. The limits now hold one difference between springs and the method and one caution about reading the result. The phrase "the best line described above" tells the reader that the rod's resting place and the Simple Explanation's smallest total are the same line.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## k-Nearest Neighbours

`knn` · Machine Learning · beginner · verdict: **substantial**

### 1. Overall diagnosis

The town of football supporters is a clear and likeable example, and the Simple Explanation uses it to teach both the method and the effect of choosing k (one neighbour, five, the whole town). The picture is the same town with flags instead of marks on a map, and it repeats the method. Its last two sentences are new and important: no theory was needed, and no preparation. The limits then cover scale, many measurements and cost. The opportunity is to give the picture entirely to what the method does not do.

### 2. Repetition map

- **Look at the k nearest houses and take the majority.** Simple Explanation, then the picture in full. Remove from the picture except as a passing clause.
- **No theory and no advance study.** Picture only. This is what sets the method apart and matches the lesson's summary (no training step; all the work happens when a question is asked). Make it the picture.
- **Cost of measuring to every house.** Limits only. It is the other side of "no preparation". Keep; the revised picture now leads into it.

### 3. Revised copy

**The Simple Explanation** (unchanged)

k-nearest neighbours is a way to label something new by looking at the labelled things most similar to it. Imagine a map of a town where every house is marked with the football team that family supports. A new family moves in, and you want to guess their team. A sensible guess is to look at the few houses closest to theirs and see which team most of them support. That is the whole method. The letter k is just the number of neighbours you ask. Ask only one, and a single odd household can fool you. Ask five and take the majority, and the guess is steadier. Ask the whole town, and you only learn which team is most popular overall. Computers use the same idea with measurements in place of streets. A fruit can be described by its weight and its colour. Two fruits with similar numbers sit close together on a chart, and a new fruit gets the label that most of its nearest neighbours carry.

**A picture to hold on to: Asking the nearest houses** (title unchanged, text revised)

Notice what you never had to do in that town. You did not need a theory of why people support the teams they do. You did not need to study the town beforehand or boil it down to any rule. You kept the map, and when a new family arrived you walked to the k houses nearest theirs and counted. Everything the method knows is the map itself, and all of its work happens at the moment a question is asked.

**Where the picture stops** (unchanged)

On a street map, distance has an obvious meaning and only two directions matter. Real data may have dozens of measurements in different units, such as grams and centimetres, and then the answer depends on how each one is scaled. With very many measurements, almost every point is far from every other, and the "nearest" neighbours are hardly nearer than the rest. The picture also hides the cost: to be sure which houses are nearest, the plain method measures the distance to every house in town, every time a new family arrives.

### 4. Editorial rationale

The picture used to be a second reading of the Simple Explanation. It now makes the point that distinguishes this method from almost every other on the site: there is no learning step and no summary of the data. That prepares the reader for the last limitation, the cost of measuring the distance to every house each time, which before arrived without warning.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## k-Means Clustering

`k-means` · Machine Learning · beginner · verdict: **substantial**

### 1. Overall diagnosis

The notice boards are a good example and the Simple Explanation tells the whole procedure through them. The picture is titled "Moving the notice boards" and tells it again: adopt the nearest board, move the boards, switch, repeat. Nothing in it is new. The limits are long but each of the four points is a real difference or a real trap. The Simple Explanation leaves one natural question open: why would the switching ever stop? The picture can answer it.

### 2. Repetition map

- **Pick the nearest board; move each board to the middle of its group; repeat until nobody switches.** Simple Explanation, then the picture, step for step. Remove the retelling.
- **Nobody defined the groups in advance.** First sentence of the Simple Explanation, last sentence of the picture. A short echo of the central idea. Keep as the picture's closing line.
- **You must choose k.** Simple Explanation; the limits add the consequence (the method makes that many groups whether or not they exist). Keep both.
- **Why it stops.** Nowhere. Add to the picture.

### 3. Revised copy

**The Simple Explanation** (unchanged)

k-means is a way to sort things into groups when nobody has told you what the groups are. Imagine a town that wants to put up three notice boards, so that everyone lives close to one of them. Where should they go? Start by putting the boards anywhere. Each household then picks the board nearest to it, which splits the town into three groups. Now move each board to the middle of the group that picked it. Some households will find that a different board has become their nearest, so they switch. Move the boards again, and keep going. After a few rounds nobody switches, and you stop. The boards now mark the centres of three neighbourhoods. Computers do the same with any kind of measurement, not only positions on a map. They can group customers with similar shopping habits, or the colours in a photograph. The letter k stands for the number of groups, and you have to choose it yourself.

**A picture to hold on to: Moving the notice boards** (title unchanged, text revised)

Watch one round at the notice boards and ask who gains. When a household switches to a board that has become nearer, its own walk gets shorter. When a board moves to the middle of the households that chose it, that group as a whole is better served than before. Neither move ever makes things worse, so the town cannot go round in circles. Sooner or later a round passes in which no household switches, and that is where the method stops. Nobody had to define the neighbourhoods in advance.

**Where the picture stops** (unchanged)

A real board cannot stand in the middle of a lake, but a centroid is a plain average and can land where there are no points at all. Households would measure distance along streets; the method uses straight-line distance and squares it, so a few far-away households pull a board strongly. The town also has to decide the number of boards before it starts, and the method will carve out that many neighbourhoods whether or not the town really has them. Finally, a bad first placement can leave two boards sharing one neighbourhood while another neighbourhood has to share a single board with its neighbour, and the procedure will not notice.

### 4. Editorial rationale

The picture now explains why the procedure settles, which the Simple Explanation only reports. This also makes the last limitation easier to understand: the method stops when its two moves can no longer improve things, and that is not the same as having found the best arrangement. The four limitations stay as they are. The second (straight-line distance, squared) is the precise meaning of "better served".

### 5. Accuracy flags

The revised picture adds the standard argument for why k-means stops: neither step can increase the total squared distance. It is correct, and "better served" is deliberately loose because the exact measure is the sum of squared distances, which the limits and the worked example introduce. Please check the wording against the level 2 account of the cost.

### 6. Unresolved questions

None.

---

## Principal Component Analysis

`pca` · Machine Learning · intermediate · verdict: **none**

### 1. Overall diagnosis

The height and arm span example makes the first direction something the reader could name ("overall size") and the second something they could recognise (arms long for one's height). The shadow of a fork is a different and complementary idea: reducing measurements is flattening, and some angles of flattening keep more than others. The limits are all to the point, and the first (the widest shadow may hide the difference you care about) is the warning a practitioner most needs. No change.

### 2. Repetition map

- **Keep the direction with the most spread.** Long way along the cloud in the Simple Explanation, most spread-out shadow in the picture. The first says what the direction is; the second says why spread is the thing to keep. Keep both.
- **Something is lost.** "Little lost" in the Simple Explanation, "loses the least" in the picture, and the limits say when the loss matters. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Principal component analysis finds the directions in which a set of measurements varies most. Suppose you measure the height and the arm span of everyone in a school. Tall pupils tend to have long arms, so the two numbers mostly rise and fall together. Plot each pupil as a dot, with height across and arm span up, and the dots form a long thin cloud running diagonally. The long way along that cloud is the first principal direction. You could call it overall size. One number, how far along the cloud a pupil sits, tells you most of what the two measurements told you. The short way across the cloud is the second direction. It holds what is left over, such as arms that are unusually long for a pupil's height. The method finds these directions by arithmetic alone. Nobody tells it what size means. It earns its keep when there are not two measurements but fifty. Often a handful of directions hold nearly all the variation, and the rest can be dropped with little lost.

**A picture to hold on to: The shadow that shows the most** (title unchanged, text unchanged)

Hold a fork between a lamp and a wall and turn it. End-on, its shadow is a small blob that could be anything. Side-on, the shadow is long and you can count the prongs. A shadow is a flattened copy of an object: three dimensions pressed into two. Principal component analysis chooses the angle that makes the shadow of a cloud of points as spread out as possible, on the grounds that the most spread-out shadow keeps the points furthest apart and so loses the least.

**Where the picture stops** (unchanged)

The widest shadow is not always the one that shows what you care about. Two kinds of point can differ in a direction where the cloud is thin, and the widest shadow would press them together. A lamp also flattens three dimensions to two, while the method goes from any number of measurements to any smaller number, which no picture can show. And a cloud that is bent like a horseshoe has no flat shadow that does it justice, because the method can only choose a straight direction to look along.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Logistic Regression

`logistic-regression` · Machine Learning · intermediate · verdict: **light**

### 1. Overall diagnosis

The doctor's chart gives the reader a line, two sides and the idea that confidence grows with distance from the line. The ramp adds the missing piece: what the probability looks like across the whole chart, and what training does to it (turn, slide, steepen). That is a real second view. The only friction is vocabulary. The Simple Explanation speaks of patients who are ill or not; the picture and limits switch without notice to "class 1" and "class 0".

### 2. Repetition map

- **A straight boundary only.** Last two sentences of the Simple Explanation, then the first limitation in the ramp's terms. The second shows why no adjustment of the ramp can help and gives an example (a boundary that closes on itself). Keep.
- **Sure far from the line, unsure near it.** Simple Explanation; the ramp shows the same thing as height. The picture turns a statement into a shape. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Logistic regression is a way to answer yes-or-no questions with a probability. Think of a doctor deciding whether a patient has a certain illness, using two measurements such as temperature and heart rate. Past patients are dots on a chart: one colour for those who were ill, another for those who were not. Logistic regression draws a straight line across the chart to separate the two colours as well as it can. A new patient far on one side of the line gets a confident answer, such as nine chances in ten of being ill. A patient right on the line gets fifty-fifty. Close to the line the answer is unsure, which is honest. The computer finds the line by starting with a poor one. It checks how wrong its probabilities are for the patients it already knows about, shifts the line a little to be less wrong, and repeats. The method can only draw a straight line. If the two colours cannot be split that way, it does a poor job.

**A picture to hold on to: A ramp between a plain and a plateau** (title unchanged, text revised)

Picture the chart as a landscape seen from above. Along one straight line the ground is at exactly half height. On one side it rises smoothly to a plateau at height 1, and on the other it falls smoothly to a plain at height 0. The height at any spot is the model's probability that a patient there is ill. Training turns the ramp, slides it and makes it steeper, until the patients known to be ill stand on high ground and those known to be well stand on low ground.

**Where the picture stops** (revised)

This ramp has the same profile all the way along, so its contour lines are straight and parallel. A real pattern may need a boundary that curves or closes on itself, which no turning or sliding of a straight ramp can produce. The height is also only the model's belief. It matches real frequencies only when a straight ramp is a fair description of the data. And if the two groups can be separated perfectly, training never finishes shaping the ramp: it keeps steepening it toward a cliff.

### 4. Editorial rationale

The picture and limits now speak about the same patients as the Simple Explanation. "Class" is introduced in the worked example and in Words to know, which is soon enough. Nothing else changed.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Decision Tree Learning

`decision-tree` · Machine Learning · intermediate · verdict: **none**

### 1. Overall diagnosis

The phone company example is concrete, the Simple Explanation ends on the one trap that matters, and the remark that the path gives the reasons is a strong selling point stated without fuss. The field-guide key is short and gives the reader an object they may have used. The limits are long, but all four points are true differences between a key a botanist writes and a tree a computer learns, and each one tells the reader something about learned trees. No change.

### 2. Repetition map

- **The computer chooses the question that separates best.** Simple Explanation, then the picture's last sentence. The repeat is the hinge between the key and the method. Keep.
- **One question at a time.** Simple Explanation ("each of the two groups gets a question of its own"); the limits add that the choice never looks ahead. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A decision tree is a list of yes-or-no questions, asked in order, that ends in a prediction. Think of a phone company that wants to know which customers are about to leave. It has records of past customers: how long each had been with the company, how often each rang to complain, and whether they left. The computer looks for the single question that best sorts those records into leavers and stayers. Perhaps it is: did they complain more than twice? No question sorts perfectly, so each of the two groups gets a question of its own, and so on. Drawn on paper, the questions branch like an upside-down tree. To predict for a new customer, start at the top and follow the answers down. The path also tells you why, because the reasons are the answers along the way. There is one trap. Keep adding questions and the tree ends up memorizing the old customers, quirks and all. Then it predicts new customers worse, not better.

**A picture to hold on to: The key at the front of a field guide** (title unchanged, text unchanged)

Many field guides open with a key. Are the leaves needles or flat? If needles, do they grow in bundles? Each answer sends you to another question until you arrive at a name. A decision tree is a key of exactly that kind, with one difference: nobody wrote it. The computer built it from a pile of specimens that were already named, by choosing at each step the question that separated them best.

**Where the picture stops** (unchanged)

A botanist writes a key from an understanding of plants, and it holds for every specimen of the species. A learned tree knows only the specimens it was shown, and a different pile could give a different key. The botanist can plan the whole key at once, while the tree is built one question at a time by a simple score that never looks ahead. The questions are also narrower than a botanist's: each asks whether one number is above or below a value. Finally, a key ends in a certain name. A leaf of a learned tree ends in a majority, and some of the specimens that reached it may have been something else.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Perceptron

`perceptron` · Deep Learning · beginner · verdict: **substantial**

### 1. Overall diagnosis

The ruler on a table of fruit is a fine example, close to the real thing, and the Simple Explanation tells the whole method through it, including the guarantee and its condition. The picture is the same ruler and the same fruit, repeating the routine in five sentences. The limits are where the interesting material is, but most of it describes how the routine behaves, not where the ruler misleads: a nudge can undo earlier work, and the routine stops at the first position that works.

### 2. Repetition map

- **Check each fruit; do nothing if right; shift the ruler toward it if wrong; go round again.** Simple Explanation, then the whole picture. Remove from the picture.
- **Stops only if a straight ruler can separate the fruit.** Simple Explanation, then the last limitation. An essential condition, and the limits add the concrete case of a curve. Keep both, briefly.
- **A nudge can spoil a fruit that was right.** Limits only. A behaviour of the method that the ruler shows well. Move to the picture.
- **Stops at the first working position.** Limits only. Same. Move to the picture.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A perceptron is a simple machine for sorting things into two groups, and it learns from its own mistakes. Picture a table with apples and oranges scattered across it and a ruler lying on the table. The rule is that everything on one side of the ruler is called an apple, and everything on the other side an orange. At first the ruler is in a poor position. So you check the fruit one at a time. If a fruit is on the correct side, you do nothing. If it is on the wrong side, you shift the ruler toward it, enough to give that fruit a better chance next time. Then you move on to the next fruit, and go round the table again and again. If a straight ruler can separate the fruit at all, this routine is certain to find a position that gets every one right, and then it stops. If no such position exists, it never stops fiddling. The perceptron began as a model of a single brain cell, and today's neural networks are built from units much like it.

**A picture to hold on to: What one nudge does** (title changed, text revised)

Watch what a single nudge of the ruler does. It shifts and turns the ruler toward one fruit that was on the wrong side, and it takes no account of any other fruit. So a nudge that helps one fruit can push another, previously correct, onto the wrong side, to be put right on a later round. That is why the ruler has to go round the table several times. The routine also stops at the first position that gets every fruit right, even if the ruler ends up brushing against a fruit when there was room to sit comfortably between the two groups.

**Where the picture stops** (revised)

The ruler is nearly the real thing: with two measurements for each fruit, the perceptron's boundary is a straight line. One detail the picture leaves vague is the size of each nudge, which is fixed by where the offending fruit sits, not by how wrong the ruler is. And a ruler is straight. If the two kinds of fruit can only be separated by a curve, you will go round the table for ever.

### 4. Editorial rationale

The picture now shows the method in motion: nudges interfere with each other, and the routine is satisfied with any position that works. Those two behaviours explain what the reader will see in the worked example (more than one pass) and why later methods look for a boundary with room to spare. The limits are left with what the ruler hides and the one condition that matters most.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Backpropagation

`backpropagation` · Deep Learning · advanced · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation sets up the problem well (which of millions of weights to change, and by how much) and answers it with a factory line where blame is passed back from worker to worker. The picture is the same factory line, with the same inspector and the same message travelling back. The reader learns nothing new from it. The limits are precise and all three matter. What the introduction never says is why passing a message back is clever, and the factory can show it.

### 2. Repetition map

- **A fault is found at the end; each worker works out their share and passes the rest back.** Simple Explanation, then the whole picture. Keep in the Simple Explanation. In the picture keep only what a worker needs and hands on.
- **Forwards for the guess, backwards for the blame.** Simple Explanation and the takeaway. Not repeated in the picture. Good.
- **The message changes nothing by itself.** Limits. This corrects a natural misreading of both sections. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Backpropagation is how a neural network finds out which of its settings to blame for a mistake. A neural network is a chain of simple calculations with many adjustable numbers, called weights. It makes a guess, and the guess is compared with the right answer. Usually the guess is somewhat wrong. The hard question is which weights to change, and by how much, when there may be millions of them. Think of a factory line where each worker passes a part to the next. A faulty product comes out at the end. The inspector tells the last worker what was wrong. That worker works out how much was their own doing and how much came from the part they were handed, and passes that message back. So it goes, worker by worker, to the start of the line. Backpropagation does this with numbers. It runs the network forwards to get the guess, then sends the error backwards, and every weight learns which way to move. The network nudges each weight a little and tries again.

**A picture to hold on to: Tracing a fault back along a production line** (title unchanged, text revised)

There is a slow way to assign blame on the factory line. Change one worker's setting a little, run the whole line again, and see whether the product improves. Then do the same for the next worker, and the next. With millions of workers that is millions of runs. The message passed back from the inspector does the job in a single trip. Each worker needs only the message from the worker after them. From it they work out how their own setting contributed, and how much of the fault was already in the part when it arrived, and they hand that second figure on. One run forwards and one message back, and everyone knows.

**Where the picture stops** (unchanged)

Workers use judgment. Backpropagation uses one rule of calculus, applied mechanically, and its messages are exact rates of change that hold only for very small adjustments. In a network each unit also feeds many others, so blame comes back along many paths at once and has to be added up. And the message alone changes nothing. Deciding how far to move each setting is a separate step, done by gradient descent.

### 4. Editorial rationale

The Simple Explanation asks the hard question and describes the answer. The picture now says why the answer is a good one: the obvious alternative costs one run of the network per weight, and the backward message costs one trip in total. That is the reason backpropagation made large networks trainable, and it gives the reader a reason to care about the mechanics that follow. If the owner would prefer not to add this, the fallback is to delete the factory from the Simple Explanation and keep the original picture, so the story is told once.

### 5. Accuracy flags

The comparison with adjusting one weight at a time and re-running the network is standard and correct, but it is new to this lesson. Please check it against how level 2 or 3 describes the cost of backpropagation.

### 6. Unresolved questions

None.

---

## Convolution and Edge Detection

`convolution` · Computer Vision · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is already close to a physical description: lay the kernel over a patch, multiply, add, slide. It then shows what two different kernels do. The card with nine windows repeats the lay, multiply, add and slide with a card in place of a kernel. Its real insight is buried in the last limitation: a card reports how well each patch matches its own pattern. That is the idea that makes convolution make sense, and it belongs in the picture. The limits are among the longest on the site and include a point about the strict definition that Words to know covers.

### 2. Repetition map

- **Lay over a patch, multiply pairwise, add, write one number, slide.** Simple Explanation, then the picture. Keep in the picture as a single sentence so the card is understood.
- **The kernel decides the result.** Simple Explanation, with blur and edge examples. The picture can say why: the numbers are a pattern being looked for.
- **A card reports how well a patch matches its pattern.** Limits only. Move to the picture.
- **Scale (millions of patches).** Limits. Not something a reader would misunderstand. Remove.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A picture on a screen is a grid of tiny squares called pixels. Each pixel is stored as a number that says how bright it is. Convolution makes a new picture from an old one with the help of a small grid of numbers called a kernel. Lay the kernel over one patch of the picture. Multiply each pixel in the patch by the kernel number lying on top of it. Add up the results. That single sum becomes one pixel of the new picture. Then slide the kernel one step along and do it again, until it has visited every patch. Different kernels do different jobs. If all the kernel numbers are equal, each new pixel is an average of its neighbours, and the picture turns blurry. If one side of the kernel is negative and the other side positive, the sum is zero where the picture is smooth and large where the brightness changes suddenly. Those sudden changes are edges: the outlines of things.

**A picture to hold on to: A card with nine windows** (title unchanged, text revised)

Take a card with a three by three block of windows cut in it, and write a number beside each window. Lay the card on a page covered in numbers, multiply what shows through each window by the number beside it, add up the nine products, and write the total on a second sheet at the matching place. Then slide the card one square and repeat. Think of the numbers on the card as a pattern the card is looking for. The total comes out large where the patch of page beneath resembles that pattern and small where it does not, so the second sheet is a map of where the pattern was found.

**Where the picture stops** (revised)

The card hides a choice about the border, where it would hang off the page. Here the card simply never goes there, so the second sheet comes out smaller. And a card finds only its own pattern. An edge card says where brightness changes. It does not know whether the edge belongs to a face or a shadow.

### 4. Editorial rationale

The picture now gives the reader a way to think about any kernel, not only the two in the Simple Explanation: it is a small pattern, and the output shows where the image looks like it. The limits keep the border choice, which the worked example depends on (the kernel fits in only four places), and the reminder that finding an edge is not understanding a picture. The half-turn required by the strict definition was removed from the introduction because "Cross-correlation" and "Convolution" are both defined in Words to know.

### 5. Accuracy flags

1. "The total comes out large where the patch resembles that pattern" is a fair summary for kernels like the edge detector, and it restates the original's "how well each patch matches its own pattern of numbers". For a kernel of all equal numbers the total is large wherever the page is bright. The simplification should be checked against level 2.
2. The lesson teaches the operation without the half turn (cross-correlation) under the name convolution. That is common practice and Words to know addresses it. Confirm the definition there is enough once the sentence leaves the limits.

### 6. Unresolved questions

None.

---

## Graph Neural Networks

`graph-neural-network` · Deep Learning · advanced · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation does a lot in a short space: what a graph is, what a round of message passing does, why rounds matter, and where the weights come in. The village is a natural picture of it, and its explanation of why news takes two days to travel two doors is the clearest sentence on the subject. That same idea is stated just before, at the end of the Simple Explanation's account of rounds. The limits contain one excellent point (an average hides who said what and how many spoke) and one about fixed rounds, with two more that repeat the Simple Explanation.

### 2. Repetition map

- **Each round carries information one link further.** Simple Explanation (two sentences), then the village (three sentences, with the notebook in between). The village explains it better. Shorten the Simple Explanation to a single sentence and let the village do the explaining.
- **Everyone uses the same recipe.** Simple Explanation, then the limits. Remove from the limits.
- **The recipe is found by training.** Simple Explanation, then the last limitation. Remove from the limits.

### 3. Revised copy

**The Simple Explanation** (revised)

Some things are best described as a network: people and their friendships, towns and the roads between them, atoms and the bonds that hold a molecule together. A network like this is called a graph. Each thing is a node, and each link is an edge. A graph neural network is a way for a computer to work out something about each node by letting the nodes talk to their neighbours. Every node starts with a few numbers that describe it. Then comes a round of message passing. Each node collects its neighbours' numbers, averages them, and mixes that average with its own numbers by a fixed recipe. All the nodes do this at the same moment, and all of them use the same recipe. Each round carries what a node knows one link further. The recipe contains adjustable numbers called weights. Training means trying many examples and nudging the weights until the final numbers give good answers.

**A picture to hold on to: News passed between neighbours** (title unchanged, text revised)

Picture a village in which each household talks only to the houses next door. Once a day, at the same hour, every household asks its neighbours what they wrote in their notebooks yesterday, averages what it hears, and writes a new entry that mixes that average with its own last entry. News from next door arrives in one day. News from two doors away takes two days, because it first has to be written into the notebook in between. After a week, each notebook reflects everything within seven houses and nothing beyond.

**Where the picture stops** (revised)

Villagers remember who told them what and can ask follow-up questions. A node only gets an average, so it cannot tell which neighbour said what, or even how many neighbours it has. Real gossip also keeps travelling for as long as people talk, while a graph neural network runs a small fixed number of rounds, so news from far away never arrives at all.

### 4. Editorial rationale

The idea that rounds extend a node's reach is now stated once in the Simple Explanation and explained once in the picture, where the notebook in between makes the reason plain. "And nothing beyond" was added to the picture from the lesson's own takeaway, because the limit of reach is as important as the reach. The limits lost two sentences that the Simple Explanation had already covered.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Attention and the Transformer

`attention` · Deep Learning · advanced · verdict: **light**

### 1. Overall diagnosis

This is the longest Simple Explanation on the site and it earns most of its length: a sentence that needs attention to be understood, the question and label idea, the pie of shares, and a plain statement of what a transformer is. The room of people is the same question-and-label idea with people in place of words. It does add one thing, a third card, which separates what a person advertises from what they hand over. The Simple Explanation blurs that distinction, and the worked example depends on it (query, key and value). The picture should make it explicit.

### 2. Repetition map

- **Compare one question with every label and score the match.** Simple Explanation, then the picture. Needed in the picture to set up the three cards. Keep, compressed.
- **Shares that favour the best matches; a blend of what the others carry.** Simple Explanation (the pie), then the picture. Keep in one sentence.
- **Everyone does this at once.** Both sections. Remove from the picture.
- **Nobody writes the questions and labels by hand.** Last sentences of the Simple Explanation, then the last limitation. The limits add that the learned questions are hard to put into words. Merge so the repeat is a clause and the new point is the sentence.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Attention is a way for each word in a sentence to collect information from the other words. Take the sentence: the cat sat on the mat because it was tired. To know what "it" means, you look back at "cat". A computer needs a way to do the same. In attention, every word sends out a question, and every word also wears a label saying what it has to offer. Questions, labels and everything else are lists of numbers. The computer compares one word's question with every word's label and gives each pair a score. A high score means: this word matters to that one. The scores are then turned into shares that add up to one whole, like slices of a pie. The word takes a blend of what the other words carry, with the biggest slices coming from the highest scores. Every word does this at once, so every word ends up knowing something about its sentence. A transformer is a program built by repeating this step many times, with other steps in between. The language models behind chatbots are transformers. Nobody writes their questions and labels by hand. They are found by training on enormous amounts of text.

**A picture to hold on to: A room where everyone compares notes** (title unchanged, text revised)

Picture a room of people, each holding three cards. The first card is a question: the kind of thing this person wants to know. The second is a badge, worn where everyone can see it, saying what this person knows about. The third is a page of notes, and it is the only card that changes hands. The badge is there to be matched against questions. The notes are what a good match earns. Each person compares their question with every badge in the room, their own included, then collects notes from everyone, taking a large share from the people whose badges matched well and a small share from the rest. Everyone leaves with a new page that mixes what the room knew, tilted towards what they asked about.

**Where the picture stops** (revised)

People would ask one or two others and ignore the rest. Attention takes a share from everyone it is allowed to see, and no share is ever exactly zero, only small. The cards are lists of numbers, a match is a sum of products, and nothing in the room understands anything. And because the questions and badges of a trained model were set by training, not written by anyone, it is often hard to say in words what a particular question is asking.

### 4. Editorial rationale

The picture is the same room at the same length. Three short sentences now tell the reader that the badge and the notes are different things with different jobs, which is the step from the Simple Explanation's "label" to the query, key and value of the worked example. The limits no longer restate that training sets the questions; they use it as the reason the questions are hard to interpret.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Diffusion Models (DDPM)

`ddpm` · Deep Learning · advanced · verdict: **none**

### 1. Overall diagnosis

The Simple Explanation is clear about the two directions: adding speckle is easy, removing it has to be learned, and generation is removal starting from nothing but speckle. The ink drop is a different image with a different job. It explains where the word "diffusion" comes from and makes the backwards direction feel strange in the right way. The limits are exact: no particular drop is recovered, nothing moves between pixels, and the backwards step is learned, not given. No change to the three sections.

### 2. Repetition map

- **One small backwards step, applied many times.** Simple Explanation, then the picture. The step is the heart of the method, and the second telling is in a different medium. Keep both.
- **A different result every time.** Simple Explanation, then the first limitation, which adds the stronger point that nothing is being recovered. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A diffusion model makes pictures by learning to undo damage. Take a clear photo and sprinkle a little random speckle over it, like static on an old television. Do it again, and again. After many rounds nothing is left but static. That direction is easy and needs no cleverness. Now imagine a program that has watched this happen to millions of pictures. It learns to look at a speckled picture and guess what the clean one underneath was. To make a brand new picture, start from pure static. Ask the program for its guess, and use it to wipe away a little of the speckle. Then ask again. Step by step, shapes come out of the static. The starting static is different every time, so the finished picture is different every time. The demonstration on this page is open about one limit. Its guesser is a plain formula that knows only four tiny pictures by heart, so those four are all it can ever produce.

**A picture to hold on to: A drop of ink in water, played backwards** (title unchanged, text unchanged)

Let a drop of ink fall into a glass of water. At first it is a sharp, intricate shape. Random jostling of the water spreads it out, and after a while the glass is an even grey with no trace of the shape. Film this and play it backwards: an even grey gathers itself into a drop. A diffusion model learns what one step of that backwards film looks like. Given a slightly-too-blurry frame, it produces a slightly sharper one. Starting from plain grey and applying that step many times, it arrives at a drop.

**Where the picture stops** (unchanged)

Real diffusion cannot be run backwards, and the model does not recover any particular drop that once existed. It makes up a plausible one, and a different one every time, because the grey it starts from is fresh random noise. Ink also spreads by moving through space, while the model's noise is added to each pixel separately and nothing moves. And the picture leaves out the hard part: the backwards step is not a law of nature here. It has to be learned from examples, and the result is only as good as that learning.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

The Simple Explanation ends with two sentences about the demonstration on the page (its guesser knows only four tiny pictures). They are honest and should stay somewhere, but they describe the demonstration before the reader has reached it. Would they sit better beside the demonstration itself? Left in place for now.

---

## Monte Carlo Estimation

`monte-carlo` · Statistics · beginner · verdict: **none**

### 1. Overall diagnosis

Pebbles thrown into a field give the method in one image, and the Simple Explanation is frank about its slowness, with a figure the reader will remember. The opinion poll is a second case, not a second telling. It brings a fact the pond cannot: accuracy depends on the size of the sample and hardly at all on the size of the thing sampled. The limits distinguish a pollster's difficulties from a computer's and are honest about pseudo-random numbers. No change.

### 2. Repetition map

- **A random sample stands in for the whole.** Pond, then poll. Different cases that make different points. Keep both.
- **More samples help, slowly.** Simple Explanation. The poll's "about a thousand" and "a few percentage points" give the same rule a familiar size. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Monte Carlo estimation answers a hard question by trying random cases and counting. Suppose you want to know the area of an oddly shaped pond in a square field. Measuring it directly is difficult. Instead, throw a thousand pebbles into the field without aiming, so they land everywhere equally often. Then count how many splashed. If about three in every ten pebbles hit the water, the pond covers about three tenths of the field. No geometry was needed, only counting. More pebbles give a better answer, though the improvement is slow. To get an answer ten times closer, you need about a hundred times as many pebbles. Computers are good at this, because they can produce millions of random numbers in a second. Scientists use the same trick when a problem has too many possibilities to work through one by one, such as how light bounces around a room, or what a risky investment might be worth next year.

**A picture to hold on to: An opinion poll** (title unchanged, text unchanged)

To learn what a country of millions thinks, a pollster does not ask everyone. They ask about a thousand people chosen at random and report the fraction who said yes. The answer is usually within a few percentage points of the truth, and the size of the country hardly matters: what matters is the size of the sample. Monte Carlo estimation polls the possibilities of a mathematical problem in the same way.

**Where the picture stops** (unchanged)

A pollster's hard problem is reaching a fair sample of people, and people can refuse or change their minds. A computer has neither difficulty with points in a square. Its difficulties are different. Its random numbers come from a formula and only imitate chance. And for many real problems, drawing fair samples is itself hard, which is why more advanced sampling methods exist.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Bayesian Updating

`bayesian-updating` · Statistics · beginner · verdict: **none**

### 1. Overall diagnosis

The trick coin makes "the right amount" concrete: one head, eight in ten, eighty in a hundred. The Simple Explanation then states the rule and its two consequences in plain words. The detective repeats those two consequences, but in a setting with several suspects, which is how the rule is usually applied and which the coin does not show. The picture is short. The limits are the best part: the rule needs numbers that honest people may disagree about, and it can never name a suspect who is not on the list. No change.

### 2. Repetition map

- **Strong evidence moves belief further than weak evidence.** Simple Explanation, then mud versus a fingerprint. Keep both; the second gives the reason (who would more probably have left it).
- **A firm starting belief needs more evidence to shift.** Simple Explanation, then the unlikely suspect. A brief restatement in new terms. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Bayesian updating is a rule for changing your mind by the right amount when you learn something new. Imagine a friend hands you a coin and warns you it might be a trick coin. Before any flips you already have an opinion. Perhaps you think it is probably fair. Then you flip it. One head tells you very little, so your opinion should barely move. Eight heads in ten flips is harder to shrug off. Eighty heads in a hundred flips should convince almost anyone. The rule says exactly how far to shift after each flip. Start from what you believed. Ask how well each possibility explains what you just saw. Possibilities that explain it well gain strength, and the others lose strength. Two things follow. Strong evidence moves you further than weak evidence. And the more firmly you believed something at the start, the more evidence it takes to change your mind. Doctors reading test results and email filters deciding what is spam both reason this way.

**A picture to hold on to: A detective and the clues** (title unchanged, text unchanged)

A detective starts a case with some suspects more likely than others. Each clue shifts suspicion toward the suspects who would more probably have left it. Mud on the carpet points to anyone who came through the garden, a little. A fingerprint points to one person, a lot. No single ordinary clue settles the case, but they accumulate, and a suspect who started out unlikely needs stronger clues before the detective accuses them.

**Where the picture stops** (unchanged)

A detective weighs clues by feel, and the rule needs numbers: how likely each suspect was at the start, and how probable each clue would be if they were guilty. Those numbers can be hard to justify, and two honest people may choose different ones. The rule also only shares belief out among the suspects on the list. If the culprit was never listed, no amount of evidence will name them.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## A/B Testing

`ab-testing` · Statistics · beginner · verdict: **none**

### 1. Overall diagnosis

The Simple Explanation is exemplary for a business reader. It frames the test as a fair race, shows a small gap, explains why a gap alone proves nothing, states the one question the test asks, and ends on the rule people most often break. The twitchy scale is a different idea, not a retelling: it treats luck as measurement noise that has a size, and gives the rough threshold (a gap of about twice the twitch). All three limitations are real differences between a scale and a test, and each is something a practitioner needs. No change.

### 2. Repetition map

- **Some gap always appears by luck.** Simple Explanation, then the twitch. The scale gives luck a size that can be learned. Keep both.
- **When to believe the gap.** "Hardly ever" by luck in the Simple Explanation, "about twice the twitch" in the picture. The same judgement, first in words and then as a rule of thumb. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

An A/B test is a fair race between two versions of something. A shop wants to know whether a green Buy button sells more than its blue one. So each visitor is shown one of the two, chosen by a coin flip. After a while the shop counts. Say 10 in every 100 bought with blue, and 12 in every 100 bought with green. Is green better? Maybe. But two groups of people never behave exactly alike, even when they see the very same page. Some gap always appears by luck. So the test asks one question. If the buttons were really the same, how often would luck alone make a gap this big? If the answer is "hardly ever", the shop trusts the gap. If the answer is "quite often", it has learned nothing yet and needs more visitors. One rule is easy to break. Decide how many visitors to wait for before you start, and then wait. If you keep checking and stop the moment green is ahead, luck will fool you far more often.

**A picture to hold on to: A twitchy kitchen scale** (title unchanged, text unchanged)

You want to know whether two bags of flour weigh the same, but your scale is twitchy: weigh the same bag twice and it reads a little differently each time. One reading of each bag settles nothing. So you first learn how much the scale twitches, and then ask whether the two bags differ by clearly more than a twitch. An A/B test does this with people in place of flour. The twitch is the luck of who happened to visit. The test works out how big that twitch is for the number of visitors you had, and it calls a difference real only when the gap is about twice the twitch or more.

**Where the picture stops** (unchanged)

You can weigh the same bag again, but you cannot show the same visitor both pages as if for the first time. The test has to compare two different groups and rely on chance to make them alike. A scale twitches by the same amount every day, while visitors change with the hour, the weekday and the season. And a scale tells you how much heavier a bag is, whereas the test on its own says only whether a difference probably exists, not whether it is large enough to matter.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Exponential Smoothing

`exponential-smoothing` · Statistics · beginner · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation frames the method as a choice between fresh news and steady history, which is exactly the tension it resolves, and it states the trade between a small move and a big move in memorable words. The restaurant, in the owner's wording, is a good picture and should stay. It is familiar, it shows both "do not overreact" and "do not ignore", and the run of bad meals shows the estimate catching up with a real change. The second paragraph of the limits is the best thing in the introduction. I recommend two small changes to the owner's wording, both to remove restatement. The picture's last two sentences repeat the Simple Explanation almost word for word, and the limits' sentence on small and large weights repeats the trade the Simple Explanation has already explained better.

### 2. Repetition map

- **Keep a running estimate and move it part of the way toward each new figure.** Simple Explanation, then the picture's last sentence in nearly the same words. Keep in the Simple Explanation. In the picture replace the restatement with a mapping: opinion is the estimate, a meal is a month's figure.
- **Older figures fade.** Simple Explanation ("older months fade bit by bit"), the picture ("less and less as time passes"), then the picture's last sentence again. The first two are the idea and its picture. Remove the third.
- **Small move steady but slow; big move quick but jumpy.** Simple Explanation (best version, with flukes and odd months), then the limits in more formal words. Keep in the Simple Explanation. In the limits, name the setting and point back.
- **A one-off or a lasting change?** Simple Explanation raises it ("it might be a fluke"); the limits say the method cannot tell until later. The second completes the first. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Exponential smoothing is a way to estimate next month's number from the months before. Picture a bakery deciding how many loaves to bake. Last month it sold 120. In the months before that it sold about 100. Which number should it trust? The newest one is the freshest news, but it might be a fluke. The older ones are steadier, but things may have changed since. Exponential smoothing takes a middle path. It keeps one running estimate. Each month it compares the estimate with what really happened, and moves the estimate part of the way toward the real figure. A small move ignores flukes but is slow to notice a real change. A big move reacts fast but gets pushed around by every odd month. Recent months end up counting most, and older months fade bit by bit. Two add-ons make it more useful. One keeps track of whether sales are climbing or falling. The other remembers which months of the year are always busy, like December in a toy shop.

**A picture to hold on to: Your opinion of a restaurant** (title unchanged, text revised)

You've eaten at a restaurant many times and have a settled opinion of it. Tonight, the meal is unusually bad. You don't decide the restaurant is terrible, but you don't ignore the experience either. Your opinion drops a little. If the next few meals are bad too, your opinion keeps falling until it reflects what the kitchen is serving now. Older meals still influence your view, but less and less as time passes. Exponential smoothing treats demand in much the same way: your opinion is its running estimate, and each meal is a new month's figure.

**Where the picture stops** (revised)

Your opinion changes by instinct. Exponential smoothing changes its estimate by a precise fraction, controlled by a setting called the smoothing weight. This is the size of the move described above: small for a steady estimate, large for a quick one. The best setting depends on the data and can be found by testing different values and measuring how well they forecast.

You might also know why tonight's meal was bad: perhaps the usual chef was away. The method knows nothing about the reasons behind the numbers. It cannot tell whether a poor result is a one-off or the start of a lasting change until later observations provide more evidence.

### 4. Editorial rationale

This entry recommends changing two sentences of the owner's wording and keeping everything else, including the restaurant itself, all six sentences that tell its story, and the whole second paragraph of the limits. The picture's ending now tells the reader which part of the restaurant stands for which part of the method, where before it repeated the method. The limits introduce the smoothing weight as the name for something the reader already understands, so the trade-off is explained once, in the place where it is explained best. If the owner would sooner keep the trade-off sentence in the limits for readers who skip the Simple Explanation, nothing is wrong with it. It is a repeat, not an error.

### 5. Accuracy flags

None identified. The restaurant does not imply anything false about the method.

### 6. Unresolved questions

None.

---

## Reservoir Sampling

`reservoir-sampling` · Statistics · intermediate · verdict: **light**

### 1. Overall diagnosis

The parade is a memorable setting and the Simple Explanation states the trick exactly. It then says that two effects "balance exactly" and asks the reader to take that on trust. The radio show is the same method with a sample of one, where the numbers are small enough to check. The picture lists the chances but does not check them, so it reads as a simpler repeat. Three more sentences would turn it into the demonstration the Simple Explanation is missing.

### 2. Repetition map

- **Later items get in less often; earlier items face more chances of being replaced; the two balance.** Stated in the Simple Explanation. The picture restates the conclusion ("each song has had the same chance") without showing it. Use the picture to show it for three songs.
- **Unknown length.** Both sections. It is the condition that makes the problem interesting. Keep.
- **A sample of several.** Simple Explanation (three names), then the first limitation. A fair pointer back. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Reservoir sampling picks a fair random handful from a stream of things when you do not know how long the stream will be. Imagine watching a parade with room in your notebook for only three names. Marchers pass one at a time, and nobody will tell you how many are coming. You want every marcher to have the same chance of ending up in your notebook. Writing down the first three would be unfair to everyone after them. Here is the trick. Write down the first three. When the fourth marcher passes, give them a three in four chance of replacing a name chosen at random from your notebook. Give the fifth marcher a three in five chance, the sixth a three in six chance, and so on. Later marchers are less likely to get in. But earlier names have faced more chances of being pushed out. The two effects balance exactly. Whenever the parade ends, every marcher has had the same chance.

**A picture to hold on to: Choosing one song from the radio** (title unchanged, text revised)

You decide to remember one song from tonight's radio show, chosen fairly, without knowing how many songs will play. Remember the first song. When the second plays, flip a coin to decide whether to switch to it. When the third plays, switch with a chance of one in three. Stop there and check. The third song is the one you hold one time in three. Each of the first two won the coin flip half the time and then survived the third song two times in three, which also comes to one in three. The same balance holds at the tenth song, with a chance of one in ten, and at whatever moment the show ends.

**Where the picture stops** (revised)

This is the case of a sample of one. Keeping several items needs the extra step of choosing which held item to replace. And a fair chance is not the same as a representative result: a sample of one song says little about the whole show.

### 4. Editorial rationale

The reader can now verify the method's central claim with a coin flip and one multiplication, which is far more convincing than being told the effects balance. The removed limitation (a person cannot produce honest one-in-ten chances in their head) is true and does not help anyone understand the method.

### 5. Accuracy flags

The check added to the picture is arithmetic on the picture's own numbers: one half times two thirds is one third. It introduces "two times in three" (the chance of not switching at the third song), which was not in the original. Please confirm the wording.

### 6. Unresolved questions

None.

---

## Metropolis-Hastings

`metropolis-hastings` · Statistics · advanced · verdict: **light**

### 1. Overall diagnosis

The hiker in fog gives the rule clearly, including the part people forget (when she stays put, she writes the place down again). The island-hopping politician is the same rule on a line of islands. The picture is worth keeping for two reasons: the limits use it to make three important points, and it contains the idea that makes the method useful in practice, which is that the politician never needs the whole list, only two populations at a time. That idea is present but not stated.

### 2. Repetition map

- **Always move up; move down with a chance equal to the ratio; otherwise stay.** Simple Explanation, then the picture. The rule is the method, and the second telling is on a simpler, countable landscape. Keep both.
- **Time spent is proportional to height.** Both sections. It is the goal and the result. Keep.
- **Only local information is needed.** "You can only measure the height where you stand" in the Simple Explanation; "has no list of populations" in the picture. Make the picture say what follows from it.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Metropolis-Hastings is a way to explore a landscape in proportion to its height, when you can only measure the height where you stand. Imagine a hiker wandering through hills in fog. She wants to spend most of her time on high ground, and exactly twice as long at places that are twice as high. She has an altimeter but no map. So she follows a simple rule. Pick a random spot nearby and check its height. If it is higher, go there. If it is lower, go there only sometimes: half the time if it is half as high, one time in ten if it is a tenth as high. Otherwise stay put, and write down the place where she is standing once more. Keep a list of everywhere she stood. Over a long walk, that list traces the shape of the whole landscape. Scientists use this to study things they can score but cannot list in full, such as every arrangement of the atoms in a liquid, or every explanation that fits a set of measurements.

**A picture to hold on to: A politician touring a chain of islands** (title unchanged, text revised)

A politician wants to spend time on each island of a long chain in proportion to its population, but has no list of populations. Each day they consider moving to a randomly chosen neighbouring island and ask the two mayors for their populations. If the neighbour is larger, they go. If it is smaller, they go with probability equal to the ratio of the populations, and otherwise stay another day. Two numbers a day are all the politician ever learns, and only their ratio is used. Yet after many days, the number of days spent on each island is proportional to its population.

**Where the picture stops** (unchanged)

The islands are few and in a line. Real problems have a continuum of positions in many dimensions, where choosing a good size and direction for the proposed move is the hard part. The story also hides two facts. Successive days are not independent: where the politician is today depends on yesterday, so a week of days is worth far less than seven independent draws. And if two groups of islands are separated by a long stretch of empty ones, the politician may never cross, and nothing in the daily record would reveal that half the population was missed.

### 4. Editorial rationale

One sentence added and one word ("Yet"). They point at what is remarkable in the story: a correct division of time across the whole chain, obtained without ever knowing the total. That is what "known only up to a constant" means in the lesson's summary and Words to know, and it is why the method is used. The limits were left alone. They are long, and all three points are ones that practitioners learn the hard way.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Kalman Filter

`kalman-filter` · Robotics · advanced · verdict: **none**

### 1. Overall diagnosis

The jumping dot on a phone map is an example nearly every reader has seen, and the Simple Explanation turns it into predict, measure and blend without strain. The navigator is a different case, not a repeat: prediction runs for hours and measurements are rare. That lets the picture show what the Simple Explanation only mentions, the running score of doubt and what it does. After hours of dead reckoning a fix counts for a lot; just after a good fix a rough sighting counts for little. The limits are concise and each is useful. No change.

### 2. Repetition map

- **Move the estimate part of the way toward the measurement, according to trust.** Simple Explanation, then the picture. The picture shows trust changing over time. Keep both.
- **Keeping track of its own uncertainty.** One sentence in the Simple Explanation; the picture's last two sentences show the consequence. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A Kalman filter keeps track of something that moves when your measurements of it are shaky. Think of following a friend's car on a phone map. The dot jumps around, because satellite positioning is never exact. But you know something else as well: a car on a road moves smoothly. A second ago it was there, driving that way at that speed, so now it should be about here. The filter blends these two sources. First it predicts where the car should be now. Then it looks at the new measurement and moves its guess part of the way toward it. How far? That depends on which source deserves more trust. If the measurements are poor, it leans on the prediction. If the prediction is doubtful, it leans on the measurement. It also keeps a running score of how unsure it is, and updates that score at every step. The result is a steadier and more accurate track than the raw measurements give.

**A picture to hold on to: A navigator with a compass and a glimpse of the coast** (title unchanged, text unchanged)

A ship's navigator without satellite positioning keeps a running estimate of the ship's position from its speed and heading. This is dead reckoning, and its error grows with every hour. Now and then the navigator sights a lighthouse and gets a position fix, which has its own error. A good navigator does not jump to the fix or ignore it, but moves the plotted position toward it by an amount that depends on how much each is trusted. After hours of dead reckoning, a fix counts for a lot. Just after a good fix, the next rough sighting counts for little.

**Where the picture stops** (unchanged)

A navigator weighs things by judgement. The filter uses exact formulas that are only as good as the noise levels it is given. Tell it the sensor is better than it really is and it will follow the noise. The formulas also assume that errors are bell-shaped and that the motion follows a linear rule. A navigator can reason that the ship cannot be on land. The basic filter cannot represent a fact like that.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Particle Filter

`particle-filter` · Robotics · advanced · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation is clear and well ordered: many guesses, three repeated steps, and the reason this beats a single guess. The search party maps onto it step for step, so most of the picture is familiar by the time it is read. It has two things of its own that are easy to miss. A report like "about two kilometres from the mast" rules places out without pointing to one. And moving searchers makes sense because there are only so many of them. The second is the reason for the copying step, which the Simple Explanation describes but does not justify.

### 2. Repetition map

- **Spread guesses, score them against a reading, concentrate on the ones that fit.** Simple Explanation, then the picture. Keep, since the picture's two new points hang on it.
- **Guesses move as the thing moves.** Both sections. One sentence in the picture. Keep.
- **Why copy the good guesses and drop the bad?** Not explained in the Simple Explanation. Implied in the picture ("wasting their time"). State the reason: a fixed number of searchers.
- **Judgement versus exact proportions.** Last limitation. A weak contrast that appears in several lessons. Remove.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A particle filter keeps track of something it cannot see directly by making many guesses at once. Picture a robot in a long hallway that has lost its place. It could be in several spots, so the filter scatters a few hundred guesses along the hallway. Each guess is called a particle, and each one says, "maybe the robot is here". Then three things happen, again and again. First, when the robot drives forward, every guess is moved forward too, with a small random nudge because wheels slip. Second, the robot's sensor takes a reading and each guess is scored. A guess that would have produced that reading scores high. A guess that would not scores low. Third, the filter makes a fresh set of guesses by copying the high scorers and dropping the low ones. After a few rounds the guesses crowd around the place where the robot really is. Because the guesses can sit in several places at once, the filter can stay undecided between two spots until the readings settle the matter.

**A picture to hold on to: A search party with one radio** (title unchanged, text revised)

A hiker is lost on a moor, and the search party has only so many people. They spread out over every place she might be. Then a report comes over the radio: her phone was heard about two kilometres from the mast. That does not say where she is, but it says where she is not. Searchers standing about two kilometres from the mast are in promising places. Searchers anywhere else are wasting their time, so they walk over and join the promising ones. As the hiker moves, the searchers drift the way she is likely to drift. With each new report the party thins out in the wrong places and thickens in the right ones.

**Where the picture stops** (revised)

Real searchers can look around, think and change the plan. A particle does nothing but hold a position. Real searchers who find nothing widen the search, while the basic filter can only copy the particles it already has: if none of them is near the truth, no amount of copying will put one there.

### 4. Editorial rationale

Two short additions bring out what the search party teaches that the hallway does not: a single reading narrows the possibilities without settling them, and a limited number of guesses should be spent where they can be right. The limits keep the two differences that matter, the second of which is the method's best-known failure.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Rapidly-Exploring Random Tree (RRT)

`rrt` · Robotics · intermediate · verdict: **substantial**

### 1. Overall diagnosis

The plant growing through a rock garden is a natural image for a tree-building planner and the Simple Explanation tells the whole method through it, ending on an honest note about crooked routes. The explorers then perform the same method again: random target, nearest camp, short walk, blocked or not, trail back. Two complete analogies for one procedure is one too many. The explorers do contain the best explanation in the lesson of why the tree spreads so fast, in a single sentence. That should be the picture.

### 2. Repetition map

- **Random spot, nearest point of the tree, short step toward it, discard if blocked.** Simple Explanation (plant), then the picture (camps). Keep a compressed version in the picture to set the scene.
- **Follow the chain back to the start for the route.** Simple Explanation, then the picture's last sentence. Remove from the picture.
- **The tree is pulled outward.** Simple Explanation says random spots pull the plant in every direction. The picture gives the real reason: far-off targets are nearest to camps on the edge. The second is the better explanation. Expand it.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A rapidly-exploring random tree, or RRT, finds a way for a robot to get from one place to another without bumping into things. It works a little like a plant growing through a garden full of rocks. The plant starts as a single shoot at the robot's starting point. Again and again, the planner picks a random spot somewhere on the map. It finds the part of the plant that is closest to that spot and grows a short new twig from there toward it. If the twig would poke through a rock, it is thrown away. Otherwise it stays. Random spots are scattered all over the map, so the plant is pulled outward in every direction and soon reaches into every open area. When a twig comes close enough to the goal, the planner follows the plant back from that twig to the root. That chain of twigs is a route the robot can follow. The route is usually crooked. It is the first one found, not the shortest.

**A picture to hold on to: Explorers and a dispatcher** (title unchanged, text revised)

A team is exploring an unmapped island from a base camp. A dispatcher, who cannot see the terrain, keeps calling out random map coordinates. Each time, the camp nearest to those coordinates sends a scout a short walk in that direction. If the way is clear, the scout sets up a new camp there. If a cliff is in the way, the scout turns back. Now ask which camps answer most of the calls. While most of the island is unexplored, most coordinates fall far from every camp, and the camp nearest to a far-off point is one on the edge of the explored area. The edge camps do most of the sending, which is why the camps spread quickly across the whole island instead of crowding around the base.

**Where the picture stops** (revised)

Real scouts would learn from a cliff and walk around it. The algorithm learns nothing from a failed branch and may try the same wall many times. A real robot's position is often a list of joint angles and not a place on a map, and its obstacles in that space are invisible shapes known only through a yes-or-no collision test.

### 4. Editorial rationale

The picture now explains the words "rapidly-exploring" in the method's name. A reader of the Simple Explanation knows the tree spreads; a reader of the picture knows why a purely random rule produces purposeful-looking growth. The trail back to base was dropped because the Simple Explanation has just said it. The limitation about cars that cannot move sideways was removed as a refinement for a later level.

### 5. Accuracy flags

The expanded explanation (edge camps answer most calls because most random points lie far from every camp) is the standard account of why these trees explore quickly, and extends a sentence already in the original. Please check it reads consistently with level 2.

### 6. Unresolved questions

None.

---

## Run-Length Encoding

`run-length-encoding` · Information Theory · beginner · verdict: **light**

### 1. Overall diagnosis

Reading tiles aloud to a friend is a perfect way in: the reader invents the method before being told its name. The Simple Explanation is complete, including when the method makes things worse. The knitting pattern is a second instance of the same idea, but it is very short and shows that people already write this way. The limits then repeat the Simple Explanation's warning about text, in knitting terms, before making a new and useful point about the space the count takes.

### 2. Repetition map

- **A count, then the thing to repeat.** Tiles, then stitches. The second is three sentences long and shows the idea in everyday use. Keep.
- **No runs, no saving; ordinary text gets longer.** Last three sentences of the Simple Explanation, then the limits (a row alternating knit and purl). Keep in the Simple Explanation. In the limits keep only the contrast that is new: a designer chooses rows with repeats, and data does not.
- **The count takes space.** Simple Explanation hints at it ("every single letter now needs its own count"); the limits give the figure used in the worked example. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Run-length encoding is a way to write repeated things in less space. Suppose you are reading a row of floor tiles aloud to a friend: white, white, white, white, white, white, black, black. You would soon stop naming each tile. You would say "six white, then two black" instead. That is the whole idea. A run is a stretch of the same thing repeated, with nothing else in between. Run-length encoding replaces every run with two pieces of information: how many, and of what. Your friend can rebuild the row exactly, tile for tile, so nothing is lost. This saves a lot of space when the data has long runs, like a drawing with large areas of one colour. It does not help with ordinary writing, where a letter is rarely followed by the same letter. There it makes things longer, because every single letter now needs its own count.

**A picture to hold on to: A knitting pattern** (title unchanged, text unchanged)

A knitting pattern does not list every stitch. It says "knit 6, purl 2, knit 6". The knitter reads a count and a kind of stitch, and produces exactly the row the designer meant. Run-length encoding writes data the same way: a count, then the thing to repeat.

**Where the picture stops** (revised)

A designer chooses rows with long repeats. Data does not cooperate like that. The picture also hides a cost. A person reads "6" without thinking about the room it takes, but in a file the count occupies space of its own: 8 bits for every run in this lesson.

### 4. Editorial rationale

One sentence removed. It restated, with stitches, what the Simple Explanation had already said about letters. What remains in the limits is the difference between a pattern written by a person and data that arrives as it is, and the cost that the worked example goes on to count.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Huffman Coding

`huffman-coding` · Information Theory · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation moves in a sound order: equal-length patterns are wasteful, so use short ones for common letters, but then the message must still be readable, so no pattern may begin another. Morse code is the right picture, and the limits use it very well. The silence between Morse letters is exactly what the "no pattern begins another" rule removes. The one blemish is that the Simple Explanation mentions Morse in passing a few lines before the picture introduces it properly.

### 2. Repetition map

- **Morse gives E a single dot.** One sentence in the Simple Explanation, then the picture's opening. Remove from the Simple Explanation.
- **Short for common, long for rare.** Simple Explanation, then the picture. It is the principle the two codes share, so the picture has to say it. Keep.
- **No pattern may be the beginning of another.** Simple Explanation states the requirement; the limits show what goes wrong without it (E is also the start of A). The second explains the first. Keep.

### 3. Revised copy

**The Simple Explanation** (revised)

Huffman coding is a way to write a message using as few 0s and 1s as possible. A computer stores every letter as a pattern of 0s and 1s, and normally every letter gets a pattern of the same length. That is wasteful, because some letters turn up far more often than others. In English, e is everywhere and z is rare. Huffman coding gives short patterns to the common letters and longer patterns to the rare ones. There is one more requirement. The patterns must be chosen so that the message can be read back without any gaps between letters. For that, no pattern may be the beginning of another pattern. Huffman coding finds such a set by tying the two rarest letters together, treating the pair as one, and repeating until everything is joined into a single tree. For that message, no other set of patterns of this kind is shorter.

**A picture to hold on to: Morse code, with the gaps removed** (title unchanged, text unchanged)

Morse code gives the commonest English letters the shortest signals: E is one dot and T is one dash, while Q is dash dash dot dash. A telegraph operator therefore sends fewer signals for ordinary text than a code with equal-length letters would need. Huffman coding follows the same principle, short for common and long for rare, and works out the best lengths from actual counts.

**Where the picture stops** (unchanged)

Morse code cannot be read as an unbroken stream. One dot is E, and it is also the start of A (dot dash), so the operator must leave a silence between letters. That silence is a third signal. A Huffman code needs no silences, because no code is the beginning of another. Morse code was also fixed once for all English text, while a Huffman code is computed for one particular set of counts and is only the best code for those counts.

### 4. Editorial rationale

The Morse sentence in the Simple Explanation gave away the picture without explaining it. Removing it lets the argument run from "short for common" straight to "one more requirement", and lets Morse arrive once, with its examples.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## LZ77 Compression

`lz77` · Information Theory · intermediate · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation is clear about what the method writes (a note saying how far back and how much to copy), why the text can be rebuilt, and when the method backfires. The song sheet is a good picture and the limits use it precisely: a songwriter names the chorus, the method can only point back by distance, and a chorus with one changed word matches only up to the change. The one problem is that the Simple Explanation has already used the song sheet, in two sentences, before the picture introduces it.

### 2. Repetition map

- **"Repeat chorus".** Two sentences in the Simple Explanation, then the picture. Keep in the picture, where the limits build on it. Remove from the Simple Explanation.
- **Go back this far, copy this much.** Simple Explanation, then the picture's last sentence. This is the instruction the whole method writes, and the picture needs it to connect song to method. Keep.
- **Notes take room.** End of the Simple Explanation, then the last limitation, which adds that very short copies are not worth making. Keep.

### 3. Revised copy

**The Simple Explanation** (revised)

LZ77 is a way to make a text shorter by not writing the same thing twice. Think about how people write. Words and phrases come back again and again. LZ77 takes advantage of that. It reads the text from start to finish. At each point it looks back over the last stretch it has read and asks: have I seen what comes next before? If so, it does not write those letters again. It writes a short note instead: go back this far, and copy this many letters. If not, it writes the letter as it is. Someone holding the notes can rebuild the whole text, because every note points to something already rebuilt. The more a text repeats itself, the shorter it gets. A text with no repeats gets longer, because each note takes up room too.

**A picture to hold on to: A song sheet that says "repeat chorus"** (title unchanged, text unchanged)

A printed song does not spell out the chorus after every verse. It prints the chorus once and afterwards writes "repeat chorus". The singer looks back up the page, finds the words and sings them again. LZ77 writes that kind of instruction for every repeat it can find: look back this far, and copy this much.

**Where the picture stops** (unchanged)

A songwriter knows where the chorus is and gives it a name. LZ77 has no names. It can only point backwards by distance, and only as far as its window reaches, so a phrase that returns after a long gap is not found. It also matches exact symbols only: a chorus with one changed word is copied up to the change and no further. And every instruction costs bits, so copying one or two letters usually costs more than writing them out.

### 4. Editorial rationale

The song sheet now appears once, in the section built around it. The Simple Explanation keeps its concrete starting point (words and phrases come back) and goes straight to what the method does about it.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Byte-Pair Encoding

`byte-pair-encoding` · Natural Language Processing · intermediate · verdict: **none**

### 1. Overall diagnosis

The Simple Explanation opens with the problem (whole words are too many, single letters too few) before the method, which is the right order, and "slowest is slow plus est" makes the result easy to believe. The shorthand picture covers the same merging, but it adds what the Simple Explanation shows only once: marks defined in terms of earlier marks, a legend that grows line by line, and the fact that the legend can be used on new documents and reversed. The limits are fair and specific. No change.

### 2. Repetition map

- **Glue the most common neighbouring pair into one piece and note the rule.** Simple Explanation (t and h), then the picture (the same pair). The picture goes one step further, to a mark built on a mark. Keep both.
- **Replay the rules in order on new text.** Simple Explanation, then "anyone holding the legend". The legend is the clearer image of what is kept. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Byte-pair encoding is a way to chop text into pieces that a computer can treat as single units. Whole words make poor pieces. There are too many of them, and new ones keep turning up. Single letters make poor pieces too. There are only a few, but every text becomes a very long string of them. Byte-pair encoding finds pieces in between. It starts with the text split into single letters. Then it looks for the two neighbouring pieces that occur together most often, such as t next to h, and glues them into one new piece, th. It writes that rule down and looks again. After many rounds the common words have become single pieces. Rarer words are built from a few familiar chunks, the way slowest is slow plus est. Any new word can then be split by replaying the same rules in the same order. The pieces are called tokens. Language models, including the ones behind chatbots, read and write text as tokens made in this way or a similar one.

**A picture to hold on to: Inventing shorthand as you go** (title unchanged, text unchanged)

Someone copying out a long document by hand notices that they keep writing the same two marks side by side. They invent one new mark for the pair and note it in a legend at the top of the page: "this mark means t then h". Later they notice the new mark often sits next to e, so they invent another mark for that, defined in terms of the first. The legend grows one line at a time, and each line may use marks defined above it. Anyone holding the legend can copy out new documents in the same shorthand, and can expand the shorthand back into the original letters.

**Where the picture stops** (unchanged)

A person would invent shorthand for units that mean something. Byte-pair encoding follows the counts wherever they lead, so its pieces can cut across meaning. A person might also revise the legend later. Here a rule, once made, is never reconsidered, and the legend depends entirely on the one text it was built from. And when two pairs are equally common a person would use judgment, while the method needs a fixed tie rule so that everyone who repeats the work gets the same legend.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Diffie-Hellman Key Exchange

`diffie-hellman` · Cryptography · intermediate · verdict: **none**

### 1. Overall diagnosis

The Simple Explanation makes the reader feel that the task is impossible and then says what makes it possible: arithmetic that is easy to do and hard to undo. It leaves one thing unexplained, which is why both sides arrive at the same number. The paint answers that at a glance: yellow plus Alice's colour plus Bob's colour is the same shade whoever mixes first. The limits are long, but they carry two things a reader must not leave without: the difficulty of undoing is unproven and depends on size, and the exchange says nothing about who is on the other end. No change.

### 2. Repetition map

- **Each scrambles, swaps, and scrambles again.** Simple Explanation, then the paint. The paint shows why the two results agree. Keep both.
- **Easy to do, hard to undo.** Simple Explanation, picture (separating a mixture is impractical), and limits (hard only as far as anyone knows). Three mentions that go from claim, to image, to qualification. Keep.
- **These numbers are too small to be safe.** Simple Explanation, limits, and again in the worked example. Repeated on purpose, and rightly: it is a safety warning. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Diffie-Hellman key exchange lets two people agree on a secret number while everyone else is listening. That sounds impossible. If Alice and Bob have never met, and a stranger hears every word they say, how can they end up sharing a secret? The answer is a kind of arithmetic that is easy to do and very hard to undo. Alice and Bob each pick a private number and keep it to themselves. Each one scrambles a public starting number using their private number, and sends the result. Then each scrambles what they received, using their own private number again. Both arrive at the same final number. The listener saw the two scrambled results, but cannot work backwards to either private number, so cannot reach the final one. That final number becomes the key that locks the rest of the conversation. On this page the numbers are tiny so that you can follow every step. Numbers this small are easy to crack. They are for learning only and protect nothing.

**A picture to hold on to: Mixing paint in public** (title unchanged, text unchanged)

Alice and Bob agree, in the open, on a common paint colour, say yellow. Each secretly chooses a private colour. Each mixes their private colour into some yellow and sends the mixture to the other, where anyone can see it. Then each stirs their own private colour into the mixture they received. Both now hold yellow plus Alice's colour plus Bob's colour, the same final shade. A spy saw yellow and the two mixtures. Separating a mixture back into its ingredients is impractical, and without one of the private colours she cannot make the final shade.

**Where the picture stops** (unchanged)

Paint is only a picture of "easy to do, hard to undo". Un-mixing paint is hard for physical reasons. Undoing the arithmetic is hard only as far as anyone knows: for large, well-chosen numbers no fast method has been found, but nobody has proved that none exists, and a large quantum computer could do it. With small numbers, like the ones on this page, it is easy. The picture also says nothing about who you are mixing with. If someone sits in the middle and swaps the tins, Alice and Bob each end up sharing a colour with that person instead of with each other. The real protocol has exactly this weakness unless the messages are also signed.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## RSA

`rsa` · Cryptography · advanced · verdict: **substantial**

### 1. Overall diagnosis

The Simple Explanation is long and good. The padlock gives the idea, the two primes and their product turn it into numbers, and the closing warning is exactly what a business reader should carry away. The picture then presents the padlock again, under a title taken from the Simple Explanation's own sentence, and retells it. Its last sentence is the only new one, and it is the key to the whole idea: closing the padlock teaches you nothing about opening it. The limits are detailed, accurate and all worth having.

### 2. Repetition map

- **Anyone can snap the padlock shut; only the key opens it; the receiver hands out padlocks and keeps the key.** Simple Explanation, then almost the whole picture. Remove from the picture.
- **Not even the sender can reopen the box.** Simple Explanation, then the picture. A striking fact. Keep one mention in the picture, as a consequence of the new point.
- **Closing teaches nothing about opening.** Picture's last sentence only. Build the picture on it.
- **Finding the primes is slow.** Simple Explanation; the limits add that this is unproven and what a quantum computer would change. Keep both.

### 3. Revised copy

**The Simple Explanation** (unchanged)

RSA is a way to send a secret to someone you have never met, without agreeing on a password first. Picture a padlock that anyone can snap shut but only one key can open. The receiver hands out open padlocks to everybody and keeps the key at home. To send a secret, you put it in a box, snap a padlock on it and post it. Not even you can open it again. Only the receiver can. RSA builds this padlock out of numbers. The receiver secretly picks two prime numbers, which are numbers such as 7 or 13 that nothing divides evenly except 1 and themselves. Multiplying the two primes gives a number that is made public. It acts as the padlock. The primes themselves stay secret and act as the key. Multiplying two primes is quick. Finding them again from the answer is extremely slow when the primes are hundreds of digits long. On this page the primes are tiny, so that you can follow every step. Numbers this small can be cracked at once. They are for learning only, and you should never build your own version to protect anything real.

**A picture to hold on to: Why the padlock can be given away** (title changed, text revised)

The padlock is safe to hand out for one reason. Snapping it shut is something anyone can do, and doing it teaches you nothing about how to open it. Closing and opening are different acts, and only opening needs the key. That is the property RSA has to build out of numbers: a calculation that anyone can perform with the public number, and that can be reversed only by someone who knows the secret primes. It is also why the sender, having locked the box, cannot open it again.

**Where the picture stops** (unchanged)

A steel padlock is opened by cutting it. The RSA padlock is opened by arithmetic: anyone who can split the public number into its two primes can make the key. Nobody has proved that this splitting must be slow, and a large enough quantum computer could do it quickly. A padlock also behaves the same way every time, and for a padlock that is fine. For RSA it is a weakness: locking the same message twice gives the same result, so a spy who can guess the message can lock her guess and compare. Real systems mix random padding into the message before locking it. The picture also leaves out how a sender knows the padlock really belongs to the receiver, which needs certificates.

### 4. Editorial rationale

The Simple Explanation tells the padlock story completely, so the picture no longer retells it. It asks the one question the story raises and answers it. The answer, that locking and unlocking are different operations and only one of them needs the secret, is what "public key" means, and it prepares the reader for a worked example with a public exponent and a private one.

### 5. Accuracy flags

The revised picture describes encryption as a calculation anyone can perform with the public number, reversible only with knowledge of the primes. At this level that is accurate. Strictly, the public key is the number together with a public exponent, and the reversal uses a private exponent derived from the primes, as the worked example shows.

### 6. Unresolved questions

None.

---

## Bresenham's Line Algorithm

`bresenham-line` · Computer Graphics · beginner · verdict: **light**

### 1. Overall diagnosis

The Simple Explanation frames the problem well (you cannot light half a pixel) and reduces the method to one running number. The blocks beside a ramp make that number visible as a gap, and add the detail that makes the method cheap: the gap changes by the same amount at every stop, so the ramp never has to be measured again. The first two limitations explain how the real method avoids fractions and what happens with steep lines. The third is an observation about pixels, not about the picture.

### 2. Repetition map

- **One step along, then stay or move over by one.** Simple Explanation, then the picture (add a block or not). Keep both; the picture is where the reader sees it.
- **A running measure of drift, with a threshold of half.** Simple Explanation as a number, picture as a gap. The picture adds how the gap is updated. Keep both.
- **Whole numbers only.** Simple Explanation claims it; the first limitation explains how (scale everything, compare against zero). The second completes the first. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

A screen is a grid of tiny squares called pixels. Each pixel is either lit or dark. So how do you draw a slanted line? You cannot light half a pixel. You have to choose whole pixels that sit as close to the true line as they can. Bresenham's algorithm chooses them one at a time. It walks from one end of the line to the other, one column per step. At each step there are only two choices: stay in the same row, or move over by one row. To decide, it keeps one running number. That number says how far the chosen pixels have drifted from the true line. When the drift passes half a pixel, the walk moves over a row and the number drops back. The number is always a whole number, with no fractions. So the method only needs to add, subtract and compare, which even a very basic computer chip does quickly.

**A picture to hold on to: Stacking blocks beside a ramp** (title unchanged, text unchanged)

Picture a long, gentle ramp, and a supply of square blocks that you stack beside it so the block tops follow the ramp as closely as blocks can. Walk along the ramp one block-width at a time. At each stop, look at the gap between the ramp and the top of your stack. If the ramp has climbed more than half a block above the stack, add one block. Otherwise leave the stack alone. You never measure the ramp from the ground again. You only keep track of the gap, and the gap changes by the same amount at every stop.

**Where the picture stops** (revised)

A person would measure the gap with a ruler and get fractions. The algorithm avoids that: it scales everything by a fixed whole number first, so the quantity it tracks is always a whole number, and it compares against zero instead of against half a block. The ramp also only climbs gently to the right. Real lines can head in any direction, including steeper than 45 degrees, where the algorithm must walk row by row instead of column by column.

### 4. Editorial rationale

One sentence removed: "a pixel is a small square of light, so a drawn line still looks like a staircase when you look closely". It is true, but the stack of blocks already looks like a staircase, so it is not a way in which the picture misleads.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Graham Scan

`graham-scan` · Computational Geometry · intermediate · verdict: **substantial**

### 1. Overall diagnosis

Opening with nails and a rubber band is the best possible definition of a convex hull, and the Simple Explanation follows it with a brisk account of the scan. The picture is then the same nails and the same rubber band, defined again. It says nothing about the method. The method's central rule, that a bend to the right means a dent, is asserted in the Simple Explanation and never explained, and the rubber band can explain it. The limits contain four points, of which two are worth a first-level reader's time.

### 2. Repetition map

- **A band snaps onto the outermost nails; that outline is the hull.** Opening of the Simple Explanation, then the whole picture. Remove from the picture.
- **A computer has no rubber band.** Simple Explanation, then the first limitation, which adds what it needs instead (the sort and the stack). Keep both.
- **A right bend is a dent.** Simple Explanation only, as a rule. Use the picture to show why.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Hammer some nails into a board. Now stretch a rubber band around all of them and let go. It snaps tight against the outermost nails and ignores the rest. That outline is called the convex hull. Convex means it has no dents. A computer has no rubber band, so it needs a method. Graham scan starts at the lowest nail, which must be on the outline. It then visits the other nails in order, sweeping around like a clock hand running backwards. It joins each nail to the one before, as if drawing the outline. After each new nail it checks the last corner it drew. If the path bends left there, fine. If it bends right, that corner is a dent, so the nail there cannot be on the outline. The nail is dropped, and the corner before it is checked again. When the sweep ends, the nails still kept are the corners of the rubber band's shape.

**A picture to hold on to: A rubber band around nails** (title unchanged, text revised)

Trace the stretched band with a finger, going counter-clockwise. At every nail it touches, the band bends the same way: to the left. It cannot bend to the right anywhere, because a right bend would be a dent, and a stretched band pulls every dent flat. Graham scan turns that observation into a test. It draws a path through the nails in sweeping order, and wherever the path bends right at a nail, that nail is one the band would never touch. Dropping it is the band pulling the dent flat.

**Where the picture stops** (revised)

The band finds the whole outline at once, by physics. A computer has only a list of coordinates and must examine points a few at a time, which is why the sort and the stack are needed. A real band also rests against nails that happen to stand along a straight side, between two corners. This lesson's algorithm reports only the corners and leaves those out.

### 4. Editorial rationale

The picture now connects the image everyone remembers to the test the algorithm performs, so the turn test in the worked example is the rubber band at work and not an arbitrary rule. Two limitations were removed. That nails have thickness and bands have stretch does not affect anyone's understanding. That the scan does not extend to three dimensions is interesting and belongs at a deeper level.

### 5. Accuracy flags

The removed point about three dimensions (the hull becomes more like shrink-wrap, and no single sweeping order exists) is correct and worth keeping at level 3 if it is not already there.

### 6. Unresolved questions

None.

---

## Consistent Hashing

`consistent-hashing` · Distributed Systems · intermediate · verdict: **none**

### 1. Overall diagnosis

The Simple Explanation starts with the problem that makes the method necessary (one server added, nearly everything moves) and then gives the circle and its one rule. The bus route is close to the same picture, but it is short, it turns "the stretch of circle just behind it" into households a reader can imagine, and it covers the case the Simple Explanation leaves out: a stop that closes. The limits say what a real ring has that a town does not, including the two additions that every production system makes. No change.

### 2. Repetition map

- **Walk clockwise to the first server.** Simple Explanation, then the bus stops. Needed to set up the picture. Keep.
- **Adding one affects only the stretch before it.** Simple Explanation, then the new stop. The picture puts people on the stretch. Keep.
- **Removing one.** Picture only. New. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Big websites keep their data on many computers, called servers. To fetch a piece of data, a program must know which server holds it. A simple rule is to number the servers and do a little arithmetic on the data's name. That rule has a flaw. Add or remove one server, and almost every piece of data is suddenly assigned somewhere else. Nearly everything would have to be copied to a new home. Consistent hashing avoids this. Imagine a circle, like a clock face. Each server is given a spot on the circle. Each piece of data is given a spot too. The data belongs to the first server you meet when you walk clockwise from its spot. Now add a new server. It takes over only the stretch of circle just behind it. The data on that stretch moves to the new server. Everything else stays exactly where it was.

**A picture to hold on to: Stops on a circular bus route** (title unchanged, text unchanged)

A road runs in a ring round a town, with houses all along it and a handful of bus stops. Everybody walks clockwise along the road to the first stop they come to. If the town builds a new stop, only the households between the previous stop and the new one change their habits: they now reach the new stop first. If a stop closes, only its own passengers are affected. They walk on to the next one. Nobody else in town notices.

**Where the picture stops** (unchanged)

Houses and bus stops stand where they do for reasons. On a hash ring every position is a scrambled number with no meaning, and that scrambling is what spreads the keys evenly. Nobody walks, either: finding the next server is a quick search in a sorted list of positions. The picture also leaves out two things real systems add. Each server is given many positions, not one, so that the stretches even out. And each item is usually stored on several servers in a row, so that losing one server loses no data.

### 4. Editorial rationale

No edits. Of the pictures that stay close to their Simple Explanation, this one is short enough and adds enough to justify itself.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.

---

## Grover's Search

`grovers-search` · Quantum Computing · advanced · verdict: **none**

### 1. Overall diagnosis

This is a hard subject handled with unusual honesty. The Simple Explanation heads off the most common misunderstanding (it does not test every key at once), says what amplitudes are and what cannot be done with them, and tells the reader that machines able to do this usefully do not yet exist. The dial is a different view with its own lesson: every round turns the pointer by the same angle, so there is a right moment to stop, and going past it makes things worse. The limits are careful about what the dial is a summary of. No change.

### 2. Repetition map

- **Each round makes the right answer more likely.** Simple Explanation (the right key's number grows), then the dial (the pointer turns up). The dial adds equal steps and the overshoot. Keep both.
- **You cannot look partway through.** Simple Explanation (nobody can read the numbers directly), then the limits (looking destroys the state, so the rounds are worked out beforehand). The second draws the practical consequence. Keep.

### 3. Revised copy

**The Simple Explanation** (unchanged)

Suppose you have a huge pile of keys and one lock. Only one key fits, and the only way to find out is to try a key in the lock. An ordinary computer tries keys one at a time. On average it gets through half the pile. Grover's search is a method for a quantum computer that needs far fewer tries: for a million keys, about eight hundred. It does not test every key at the same moment. The state of a quantum computer is described by a list of numbers, one for each key, called amplitudes. Nobody can read these numbers directly. When you look at the machine you see just one key, and a key with a bigger number is more likely to be the one you see. Each use of the lock test, followed by one fixed adjustment, makes the right key's number grow and the others shrink. After the right number of rounds, looking gives the right key almost every time. Quantum computers big enough to do this for a useful problem do not exist yet. This page uses an ordinary computer to work out the same numbers.

**A picture to hold on to: Turning a dial in equal clicks** (title unchanged, text unchanged)

Picture a dial with a pointer. Straight up means "certain to see the right answer". Flat means "certain to see a wrong one". At the start the pointer is almost flat, because the right answer is one among many. Each round of the algorithm turns the pointer upward by the same small angle. After enough rounds it points nearly straight up, and that is the moment to look. Keep turning and it swings past the top and back down, so extra rounds make things worse.

**Where the picture stops** (unchanged)

There is no pointer inside the machine. The dial is a summary of a long list of amplitudes, and the turning comes from two operations that make some amplitudes add up and others cancel. Ordinary chances never cancel each other like that, which is why no everyday object behaves this way. You also cannot watch the dial. Looking at a quantum computer gives one answer and destroys the state, so the number of rounds has to be worked out beforehand. And the dial says nothing about cost. Each click needs the test to be built as a quantum circuit and run without errors, which is the hard part in practice.

### 4. Editorial rationale

No edits.

### 5. Accuracy flags

None identified.

### 6. Unresolved questions

None.
