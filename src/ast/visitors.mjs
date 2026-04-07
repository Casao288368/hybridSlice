import { Visitor } from "esrecurse"

export class ExpressionArrayVisitor extends Visitor {
    /**
     * 
     * @param {import('eslint').Scope.ScopeManager} scopeManager 
     */
    constructor(scopeManager) {
        super();
        /**
         * @type {import('estree').Literal["value"][]}
         */
        this.arguments = [];
    }

    /**
     * 
     * @param {import('estree').CallExpression} node 
     * @returns 
     */
    CallExpression(node) {
        for (const argumentNode of node.arguments) {
            this.visit(argumentNode);
        }
    }
    /**
     * 
     * @param {import('estree').Expression} node 
     */
    Expression(node) {
        return this.visit(node.arguments);
    }

    /**
     * 
     * @param {SpreadExpression} node 
     */
    SpreadExpression(node) {
        throw Error("No Spreads!");
    }

    /**
     * 
     * @param {import("estree").Identifier} node 
     */
    Identifier(node) {
        // TODO - Grab it from outside
        console.error("Found identifier ", node);
        throw Error("constant or nothing");
    }
    /**
     * 
     * @param {import("estree").Literal} node 
     */
    Literal(node) {
        this.arguments.push(node.value);
    }
    ObjectExpression(node) {
        console.warn("Not finished");
        this.arguments.push(new ObjectSimplifierVisitor().visit(node));
        throw Error("TBD");
    }

    /**
     * 
     * @param {import("estree").Node} node 
     */
    visit(node) {
        console.log("Visiting", node.type);
        super.visit(node);
    }

}


class ObjectSimplifierVisitor extends Visitor {
    expr = {};
    exprStack = [];
    // /**
    //  * 
    //  * @param {import("estree").ObjectExpression} node 
    //  */
    // ObjectExpression(node){
    // }


    /**
     * 
     * @param {import("estree").Property} node 
     */
    Property(node) {
        this.#topOfStack()?.[node.key.value];
    }

    /**
     * 
     * @param {import('estree').ObjectExpression} node 
     */
    ObjectExpression(node) {
        const x = {};
        for (const property of node.properties) {
            if (property.type === 'Property') {
                if( property.key.type==='PrivateIdentifier'){

                }
                const propertyKey = 
                x[property.key]
            }
        }
    }
    /**
     * 
     * @param {import('estree').Literal} node 
     */
    Literal(node) {
        return node.value;
    }

    /**
     * 
     * @param {SpreadExpression} node 
     */
    SpreadExpression(node) {
        throw new Error("unsupported");
    }


    visit(node) {
        console.log("Objvisit", node);
        return super.visit(node);
    }

    #topOfStack() {
        return this.exprStack[this.exprStack.length - 1];
    }
}

class GetExpressionStaticValue extends Visitor {
    /**
     * 
     * @param {import('estree').Identifier} node 
     */
    Identifier(node) {
        throw new Error('not compat');
    }
    /**
     * 
     * @param {import('estree').Literal} node 
     */
    Literal(node) {
        return node.value;
    }
    
    /**
     * 
     * @param {import('estree').BinaryExpression} node 
     * @returns 
     */
    BinaryExpression(node) {
        return this.applyOperation(super.left(node.left), super.right(node.right), node.operator);
    }
    /**
     * 
     * @param {*} left 
     * @param {*} right 
     * @param {import('estree').BinaryOperator} operator 
     */
    applyOperation(left, right, operator) {
        switch (operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            case '==': return left == right;
            case '===': return left === right;
            case '>': return left > right;
            case '<': return left < right;
            case '>=': return left >= right;
            case '<=': return left <= right;
            case '<<': return left << right;
            case '>>': return left >> right;
            case '^': return left ^ right;
            case '&': return left & right;
        }
    }
}