// import Vue from 'vue';
// import {
//   BlockDef,
//   FuncDef,
//   StatementDef,
//   VarAssignDef,
//   ConditionalDef,
//   LoopDef,
//   EditorUnit,
// } from "types/blocks";

// import FunctionDef from "components/FunctionDef";
// import Import from "components/Import";
// import Return from "components/Return";
// import { MethodAssignment, ValueAssignment } from "components/VarAssignment";
// import FunctionCall from "components/FunctionCall";
// import Conditional from "components/Conditional";
// import { For, ForEach, While } from "components/Loop";
// import DropArea from "components/DropArea";
// import Draggable from "components/Draggable";

// /**
//  * Render a JSON block to a component
//  */
// export default function JSONToComponent(obj: EditorUnit): JSX.Element {
//   const { isBlock } = obj;

//   return (
//     <Draggable key={obj.id} id={obj.id} parent={obj.parent}>
//       {isBlock
//         ? renderBlock(obj as BlockDef)
//         : renderStatement(obj as StatementDef)}
//       <DropArea parent={obj.parent} id={obj.id} />
//     </Draggable>
//   );
// }

// function renderBlock(block: BlockDef): JSX.Element {
//   const { blockType } = block;
//   switch (blockType) {
//     case "conditional":
//       return renderConditional(block as ConditionalDef);
//     case "loop":
//       return renderLoop(block as LoopDef);
//     case "definition":
//       return renderDefinition(block as FuncDef);
//   }
// }

// function renderConditional(conditional: ConditionalDef): JSX.Element {
//   return <Conditional id={conditional.id} key={conditional.id} />;
// }

// function renderLoop(loop: LoopDef): JSX.Element {
//   const { loopType } = loop;
//   switch (loopType) {
//     case "for":
//       return <For id={loop.id} key={loop.id} />;
//     case "foreach":
//       return <ForEach id={loop.id} key={loop.id} />;
//     case "while":
//       return <While id={loop.id} key={loop.id} />;
//   }
// }

// function renderDefinition(def: FuncDef): JSX.Element {
//   return <FunctionDef id={def.id} key={def.id} />;
// }

// function renderStatement(statement: StatementDef) {
//   const { statementType } = statement;
//   switch (statementType) {
//     case "functionCall": {
//       return <FunctionCall id={statement.id} key={statement.id} />;
//     }
//     case "import": {
//       return <Import id={statement.id} key={statement.id} />;
//     }
//     case "return": {
//       return <Return id={statement.id} key={statement.id} />;
//     }
//     case "variableAssignment": {
//       const varAssignment = statement as VarAssignDef;
//       return renderVarAssignment(varAssignment);
//     }
//   }
// }

// function renderVarAssignment(assignment: VarAssignDef) {
//   const { assignmentType } = assignment;
//   switch (assignmentType) {
//     case "methodCall": {
//       return <MethodAssignment id={assignment.id} key={assignment.id} />;
//     }
//     case "value": {
//       return <ValueAssignment id={assignment.id} key={assignment.id} />;
//     }
//   }
// }
