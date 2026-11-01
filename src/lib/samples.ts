/** Sample sources so a first-time visitor can explore the whole product in one click. */

export interface SampleSource {
  id: string;
  title: string;
  subject: string;
  emoji: string;
  kind: "audio" | "text" | "pdf" | "youtube";
  origin: "transcribed" | "pasted" | "extracted";
  meta: string;
  text: string;
}

export const SAMPLES: SampleSource[] = [
  {
    id: "sample-bio",
    title: "Cellular Respiration — Lecture 6",
    subject: "Biology",
    emoji: "🧬",
    kind: "audio",
    origin: "transcribed",
    meta: "48 min lecture recording · transcribed",
    text: `Cellular Respiration

Welcome back everyone. Today we are finally getting into cellular respiration, which is the process cells use to convert the chemical energy stored in glucose into adenosine triphosphate, or ATP, which is the usable energy currency of the cell. Remember this framing for the exam: respiration is not breathing. Breathing is ventilation, the mechanical movement of air. Cellular respiration is a biochemical pathway that happens inside every living cell, plant and animal alike.

The overall balanced equation is C6H12O6 plus 6 O2 yielding 6 CO2 plus 6 H2O plus energy. One molecule of glucose, fully oxidised, releases roughly 30 to 32 molecules of ATP in eukaryotic cells. Older textbooks will tell you 36 or 38, and that number changed because we now account for the cost of shuttling NADH from glycolysis across the mitochondrial membrane, which consumes proton motive force.

Glycolysis

Glycolysis is the first stage, and it happens in the cytosol, not in the mitochondria. That is a favourite trick question. Glycolysis literally means sugar splitting. One six carbon glucose is split into two three carbon molecules of pyruvate. The pathway has ten enzyme catalysed steps, and it divides into an investment phase and a payoff phase. In the investment phase the cell spends 2 ATP. In the payoff phase it earns 4 ATP and reduces 2 NAD plus into 2 NADH. So the net yield of glycolysis is 2 ATP and 2 NADH per glucose.

Critically, glycolysis does not require oxygen. That is why it is considered anaerobic. If oxygen is unavailable, cells regenerate NAD plus through fermentation, either lactic acid fermentation in animal muscle or alcoholic fermentation in yeast, so that glycolysis can keep running. Fermentation itself produces no additional ATP. It only recycles NADH back to NAD plus.

The Link Reaction and the Krebs Cycle

Once oxygen is available, pyruvate is transported into the mitochondrial matrix. There the pyruvate dehydrogenase complex converts each pyruvate into acetyl CoA, releasing one CO2 and producing one NADH. This is called the link reaction, or the transition step.

Acetyl CoA then enters the Krebs cycle, which is also known as the citric acid cycle or the tricarboxylic acid cycle. Acetyl CoA, a two carbon unit, combines with oxaloacetate, a four carbon molecule, to form citrate, a six carbon molecule. Over eight steps the cycle releases two CO2, regenerates oxaloacetate, and harvests 3 NADH, 1 FADH2 and 1 ATP by substrate level phosphorylation per turn. Because each glucose produced two acetyl CoA, the cycle turns twice per glucose, doubling those numbers.

The Krebs cycle is best understood as an electron harvesting operation. The carbon you breathed out as CO2 is the oxidised skeleton of the glucose you ate. The real product is reduced electron carriers.

Oxidative Phosphorylation

The electron transport chain sits in the inner mitochondrial membrane, specifically on the cristae, which are folds that dramatically increase surface area. NADH donates electrons at complex one, FADH2 donates at complex two. Electrons pass through a series of protein complexes, and at complexes one, three and four protons are pumped from the matrix into the intermembrane space. This builds an electrochemical gradient, which we call the proton motive force.

Oxygen is the terminal electron acceptor. It combines with electrons and protons to form water, and that is why we cannot survive without it. Without oxygen the chain backs up, NADH accumulates, and ATP production collapses.

ATP synthase, sometimes called complex five, is a molecular rotary motor. Protons flow back down their gradient through it, spinning the gamma subunit, and that mechanical rotation drives the phosphorylation of ADP into ATP. This is chemiosmosis, the mechanism Peter Mitchell proposed in 1961, for which he won the Nobel Prize in Chemistry in 1978.

Roughly 26 to 28 of the total ATP come from oxidative phosphorylation, which is why it is the dominant stage. Substrate level phosphorylation in glycolysis and the Krebs cycle only accounts for 4 ATP.

Regulation and Clinical Connections

Respiration is regulated by feedback. High ATP inhibits phosphofructokinase, the rate limiting enzyme of glycolysis, while high AMP activates it. The cell therefore slows down when it is energy rich and speeds up when it is energy poor.

Two poisons appear constantly on exams. Cyanide blocks complex four, halting electron flow entirely. Oligomycin blocks ATP synthase directly, so the gradient builds but no ATP is made. Both are lethal, and both illustrate that the chain and the synthase are coupled.

Finally, brown adipose tissue contains a protein called thermogenin, or uncoupling protein one, which lets protons leak back into the matrix without passing through ATP synthase. The gradient energy is released as heat instead of being captured as ATP, which is how newborns and hibernating animals stay warm.

To recap: glycolysis in the cytosol, the link reaction and Krebs cycle in the matrix, oxidative phosphorylation on the inner membrane. Two ATP, then two more, then roughly twenty eight. That accounting is the single most examinable thing in this lecture.`,
  },
  {
    id: "sample-hist",
    title: "American Revolution — Causes & Turning Points",
    subject: "History",
    emoji: "🏛️",
    kind: "pdf",
    origin: "extracted",
    meta: "Study guide PDF · 6 pages extracted",
    text: `Causes of the American Revolution

The American Revolution was the political and military struggle between 1765 and 1783 in which thirteen British colonies in North America rejected imperial rule, fought a war of independence, and established the United States of America.

Imperial Policy After 1763

The French and Indian War, which is the North American theatre of the Seven Years War, ended in 1763 with the Treaty of Paris. Britain won an enormous amount of territory but also inherited a national debt that had roughly doubled. Parliament concluded that the colonies, which had benefited from British military protection, should help pay for it. This ended a period historians call salutary neglect, during which trade regulations had existed on paper but were loosely enforced.

The Stamp Act of 1765 was the first direct tax Parliament imposed on the colonies. It taxed printed materials, including legal documents, newspapers, pamphlets, and playing cards. Colonial response was immediate and organised. The Stamp Act Congress met in New York, the Sons of Liberty organised protests and intimidated stamp distributors, and colonists adopted non-importation agreements. The central slogan was no taxation without representation, arguing that only a body in which colonists held elected seats could legitimately tax them. Parliament repealed the Stamp Act in 1766 but simultaneously passed the Declaratory Act, asserting its authority to legislate for the colonies in all cases whatsoever.

The Townshend Acts of 1767 imposed indirect duties on glass, lead, paint, paper, and tea. Most of these duties were repealed in 1770, but the tax on tea was deliberately retained as a matter of principle.

Escalation

The Boston Massacre occurred on March 5, 1770, when British soldiers fired into a crowd, killing five colonists, including Crispus Attucks. Paul Revere's widely circulated engraving framed the event as a massacre and became one of the most effective pieces of propaganda in the colonial cause.

The Tea Act of 1773 granted the financially troubled East India Company a monopoly on tea sales in the colonies. On December 16, 1773, the Sons of Liberty, disguised as Mohawk Indians, boarded three ships in Boston Harbor and destroyed 342 chests of tea. This event is known as the Boston Tea Party.

Parliament responded in 1774 with the Coercive Acts, which colonists called the Intolerable Acts. These closed the port of Boston, revoked the Massachusetts charter, allowed royal officials to be tried in Britain, and expanded the Quartering Act. Rather than isolating Massachusetts, the Intolerable Acts united the colonies, leading directly to the First Continental Congress in September 1774.

War and Independence

 Fighting began at the Battles of Lexington and Concord on April 19, 1775. The Second Continental Congress convened in May 1775, created the Continental Army, and appointed George Washington as its commander in chief.

The Declaration of Independence, adopted on July 4, 1776, was drafted principally by Thomas Jefferson with input from the Committee of Five, which included John Adams and Benjamin Franklin. It grounded the revolutionary argument in Enlightenment ideas drawn from John Locke, asserting natural rights to life, liberty, and the pursuit of happiness, and the right of the people to alter or abolish a government that violates those rights.

Turning Points

The Battle of Saratoga in October 1777 is conventionally identified as the turning point of the war. The American victory convinced France to enter the conflict as an open ally in 1778, providing money, naval power, and troops that Britain could not match. French support proved decisive.

The war in the south, from 1778 onward, was brutal and often civil in character. The final major engagement was the Siege of Yorktown in October 1781, where a combined American and French force under Washington and Rochambeau, supported by the French fleet under de Grasse, trapped Cornwallis's army and forced its surrender.

The Treaty of Paris, signed on September 3, 1783, formally ended the war. Britain recognised the independence of the United States and ceded territory extending west to the Mississippi River.

Legacy

The Revolution produced a republic founded on written constitutions. The Articles of Confederation, ratified in 1781, created a weak central government, and its failures led to the Constitutional Convention of 1787 and the ratification of the United States Constitution in 1788. The Bill of Rights, the first ten amendments, was added in 1791.`,
  },
  {
    id: "sample-cs",
    title: "Data Structures — Trees & Complexity",
    subject: "Computer Science",
    emoji: "💻",
    kind: "text",
    origin: "pasted",
    meta: "Pasted lecture notes · 3 pages",
    text: `Trees, Traversals and Complexity

Big O notation describes how the running time or space requirement of an algorithm grows as the input size grows. It captures the dominant term and ignores constant factors. Common classes, from fastest growing to slowest, are O(1) constant, O(log n) logarithmic, O(n) linear, O(n log n) linearithmic, O(n squared) quadratic, O(2 to the n) exponential, and O(n factorial) factorial. A binary search on a sorted array is O(log n) because the search space halves at every step. A nested loop over the same array is O(n squared).

A tree is a hierarchical data structure consisting of nodes connected by edges, with exactly one root node and no cycles. Each node may have children, and a node with no children is called a leaf. The height of a tree is the number of edges on the longest path from the root to a leaf. The depth of a node is the number of edges from the root to that node.

A binary tree is a tree in which every node has at most two children, conventionally called left and right. A binary search tree, or BST, adds an ordering invariant: for every node, all values in the left subtree are less than the node's value, and all values in the right subtree are greater. This invariant is what makes search efficient, because at each node you can eliminate half of the remaining tree.

Search, insertion and deletion in a balanced binary search tree all run in O(log n). In the worst case, however, a BST can degenerate into a linked list if values are inserted in sorted order, and every operation becomes O(n). This is why self balancing trees exist.

An AVL tree is a self balancing BST in which the heights of the two child subtrees of any node differ by at most one. When an insertion or deletion violates that balance factor, the tree performs rotations to restore it. There are four rotation cases: left left requires a single right rotation, right right requires a single left rotation, and left right and right left require a double rotation. AVL trees guarantee O(log n) for all operations but rebalance aggressively, which makes insertions slower.

A red black tree is a more relaxed balanced tree. Every node is coloured red or black, the root is black, no red node has a red child, and every path from a node to its descendant leaves contains the same number of black nodes. Red black trees guarantee that the longest path is at most twice the shortest, giving O(log n) worst case performance with fewer rotations than AVL. They are used in the Java TreeMap, the C++ standard map, and the Linux kernel's completely fair scheduler.

Traversal is the process of visiting every node exactly once. There are four standard traversals. In preorder you visit the node, then the left subtree, then the right subtree; preorder is used to serialise or copy a tree. In inorder you visit left, node, right; inorder traversal of a binary search tree yields the values in sorted order, which is one of the most examinable facts in this topic. In postorder you visit left, right, node; postorder is used to delete a tree because children are freed before their parent. In level order you visit nodes breadth first, one level at a time, which requires a queue rather than recursion.

Depth first traversals use a stack, either explicitly or through the call stack in a recursive implementation, and use O(h) space where h is the height. Breadth first traversal uses a queue and uses O(w) space where w is the widest level, which for a complete binary tree is roughly n over 2.

A heap is a complete binary tree that satisfies the heap property. In a max heap every parent is greater than or equal to its children, so the maximum is always at the root. Heaps are usually stored in an array, where for a zero indexed array the children of the node at index i are at 2i plus 1 and 2i plus 2, and the parent is at the floor of i minus 1 divided by 2. Insertion and removal both take O(log n), while finding the maximum takes O(1). Heaps power priority queues and the heapsort algorithm, which runs in O(n log n) with O(1) extra space.

Building a heap from an unsorted array using the heapify down procedure from the last internal node backwards takes O(n), not O(n log n). That counterintuitive result is a common exam question; the proof relies on the fact that most nodes are near the bottom and therefore sift down only a short distance.`,
  },
];

export function getSample(id: string): SampleSource | undefined {
  return SAMPLES.find((s) => s.id === id);
}
