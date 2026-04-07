//@ts-check
/**
* @typedef {import('estree').Literal["value"]} GenericLiteralType
*/

import tsm, { Type } from 'ts-morph';
import { simpleFaker } from '@faker-js/faker'

const LEVEL_LIMIT = 3;
export class LibraryTypesRecorder {
    /**
     * @type {Map<string,Map<string,Type[][]>>}
     */
    #calls = new Map();
    /**
     * @type {tsm.TypeChecker} checker
     */
    checker;

    /**
     * 
     * @param {tsm.TypeChecker} checker 
     */
    constructor(checker) {
        this.checker = checker;
    }
    /**
     * 
     * @param {string} moduleName 
     * @param {string} libraryFunctionSegment 
     * @param {Type[]} argumentsCalled 
     */
    pushToMap(moduleName, libraryFunctionSegment, argumentsCalled) {
        const modulePortion = this.#calls.get(moduleName) ?? new Map();

        const defArgs = modulePortion.get(libraryFunctionSegment) ?? [];
        defArgs.push(argumentsCalled);

        modulePortion.set(libraryFunctionSegment, defArgs);
        this.#calls.set(moduleName, modulePortion);
    }

    get calls() {
        return this.#calls;
    }

    generateAllArgumentsForRecordedCalls() {
        /**
         * @type {Map<string,Map<string,(GenericLiteralType|null|undefined|{})[][]>>}
         */
        const callMap = new Map();
        for (const [moduleName, modulePortion] of this.#calls) {
            /**
             * @type {Map<string,(GenericLiteralType|null|undefined|{})[][]>}
             */
            const moduleCallMap = new Map();// todo refactor
            for (const [libraryFunctionSegment, argsList] of modulePortion) {
                // const argsForFunctionSimple = argsList.map(args => args.map(arg => this.instantiateType(arg)));
                const argsForFunction = argsList.flatMap(args => simpleFaker.helpers.multiple(()=> args.map(arg => this.instantiateFakerOnType(arg))));

                moduleCallMap.set(libraryFunctionSegment, argsForFunction);
            }
            callMap.set(moduleName, moduleCallMap);
        }
        return callMap;
    }

    /**
     * 
     * @param {Type} type 
     * @param {number} [level=1]
     */
    instantiateFakerOnType(type,level=1) {
        if(level>LEVEL_LIMIT) return undefined;
        // console.log("Instantiating faker on type", type.getText(), level);
        const literalValue = type.getLiteralValue();
        if(type.isBooleanLiteral()){
            return type.getText() === 'true';
        } else if (literalValue !== undefined) {
            return literalValue;
        } else if (type.isUndefined()) {
            return undefined;
        } else if(type.isNull()){
            return null;
        } else if (type.isVoid()){
            return undefined;
        }else if(type.isBigInt()){
            return simpleFaker.number.bigInt();
        }else if (type.isString()) {
            
            return simpleFaker.string.alphanumeric();
        } else if (type.isNumber()) {
            return simpleFaker.number.int();
        } else if (type.isBoolean()) {
            return simpleFaker.datatype.boolean();
        }else if(type.isTuple()){
            return type.getTupleElements().map(t => this.instantiateFakerOnType(t,level+1));
        } else if (type.isArray()) {
            return []// TODO - handle arrays;
            //also, check if its a buffer from NodeJS
        } else if (type.isObject()) {
            // TODO check if its a buffer
            if (type.getText() === 'Buffer') {
                return Buffer.from(simpleFaker.string.alphanumeric(10));
            }

            const f = type.getCallSignatures();
            if(f.length > 0) {
                return simpleFaker.helpers.arrayElement(f.map(fn => ()=>this.instantiateFakerOnType(fn.getReturnType(),level+1)));
            }
            const newObj = {};
            for (const prop of type.getProperties()) {
                const propName = prop.getName();
                const declarations = prop.getDeclarations();
                let propType = prop.getDeclaredType();
                if (declarations.length !== 1) {
                    // console.warn("Multiple declarations for property", propName, "in type", type.getText());
                } else {
                    propType = this.checker.getTypeOfSymbolAtLocation(prop, declarations[0]);
                }
                // console.log("Instantiating faker on property", propName, "of type", propType.getText(), "in type", type.getText());
                newObj[propName] = this.instantiateFakerOnType(propType,level+1);
            }
            // TODO - handle functions
            return newObj;
        } 
        else if(type.isUnion()){
            const types = type.getUnionTypes();
            return simpleFaker.helpers.arrayElement(types.map(t => this.instantiateFakerOnType(t)));
        }
        else {
            if (type.isAny()) {
                return simpleFaker.helpers.arrayElement([
                    simpleFaker.string.sample(),
                    simpleFaker.number.int(),
                    simpleFaker.datatype.boolean(),
                    {},
                    []
                ]);
            }
            console.warn("Unknown type to instantiate", type.getText());
            return undefined;
        }

    }
}