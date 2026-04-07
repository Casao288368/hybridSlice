import {assert} from 'chai'
import tsm from 'ts-morph';
import {} from '../src/tsCalls.mjs'
import { LibraryTypesRecorder } from '../src/libcalls.mjs'

describe('Instantiation tests',function () {
    /**
     * @type {tsm.Project}
    */
   let project
   /**
    * @type {LibraryTypesRecorder}
    */
    let recorder;
    before(function () {
        project  = new tsm.Project({ compilerOptions: { checkJs: true,allowJs: true } });
        recorder = new LibraryTypesRecorder(project.getTypeChecker());
    });
    it('should instantiate a literal',function(){
        const fileScript = `export const x = 5;`;
        const { exported, recorder } = getExportedVariablesFromScript(fileScript,'file1.ts');

        assert.lengthOf(exported, 1);

        const exportedVars = exported.get('x');
        assert.exists( exportedVars)

        assert.lengthOf(exportedVars, 1);

        const exportedVar = exportedVars[0];

        const exportedVarType = exportedVar.getType();

        assert.equal(exportedVarType.getText(), '5');
        assert.equal(exportedVarType.getLiteralValue(), 5);
        assert.isTrue(exportedVar.getType().isLiteral());

        const ans = recorder.instantiateFakerOnType(exportedVarType,0);
        assert.equal(ans, 5);

    });




    it.skip('should instantiate a literal boolean',function(){
        const fileScript = `export const x = false;`;
        const { exported, recorder } = getExportedVariablesFromScript(fileScript,'file2.ts');

        assert.lengthOf(exported, 1);

        const exportedVars = exported.get('x');
        assert.exists( exportedVars)

        assert.lengthOf(exportedVars, 1);

        const exportedVar = exportedVars[0];

        const exportedVarType = exportedVar.getType();

        assert.equal(exportedVarType.getText(), 'false');
        assert.equal(exportedVarType.getLiteralValue(), false);
        console.log(exportedVarType.getLiteralValue);
        assert.isTrue(exportedVar.getType().isLiteral());

        const ans = recorder.instantiateFakerOnType(exportedVarType,0);
        assert.equal(ans, 5);

    })

    it('should instantiate an object', function() {
        const fileScript = `export const x = {x:true,y:5};`;
        const { exported, recorder } = getExportedVariablesFromScript(fileScript, 'file3.ts');

        assert.lengthOf(exported, 1);

        const exportedVars = exported.get('x');
        assert.exists( exportedVars)

        assert.lengthOf(exportedVars, 1);

        const exportedVar = exportedVars[0];

        const exportedVarType = exportedVar.getType();

        // console.log(exportedVarType.getLiteralValue);
        assert.isFalse(exportedVar.getType().isLiteral());

        const ans = recorder.instantiateFakerOnType(exportedVarType,0);
        assert.isBoolean(ans.x);
        assert.isNumber(ans.y);

    })
    it('should instantiate a tuple object', function() {
        const fileScript = `export const x = [10,'a'] as const;`;
        const { exported, recorder } = getExportedVariablesFromScript(fileScript, 'file-tuple.ts');

        assert.lengthOf(exported, 1);

        const exportedVars = exported.get('x');
        assert.exists( exportedVars)

        assert.lengthOf(exportedVars, 1);

        const exportedVar = exportedVars[0];

        const exportedVarType = exportedVar.getType();

        // console.log(exportedVarType.getLiteralValue);
        assert.isFalse(exportedVar.getType().isLiteral());

        const ans = recorder.instantiateFakerOnType(exportedVarType);
        console.log(ans);
        assert.isArray(ans);
        assert.isArray([10, 'a'], ans);

    })

    it('should instantiate a nested object', function() {
        const fileScript = `type A = {parent?:A,data:number}; export const x:A = {data:12};`;
        const { exported, recorder } = getExportedVariablesFromScript(fileScript, 'file4.ts');

        assert.lengthOf(exported, 1);

        const exportedVars = exported.get('x');
        assert.exists( exportedVars)

        assert.lengthOf(exportedVars, 1);

        const exportedVar = exportedVars[0];

        const exportedVarType = exportedVar.getType();

        // console.log(exportedVarType.getLiteralValue);
        assert.isFalse(exportedVar.getType().isLiteral());

        const ans = recorder.instantiateFakerOnType(exportedVarType);
        console.log(ans);
        // assert.isBoolean(ans.x);
        assert.isObject(ans.parent);
        assert.isNumber(ans.data);

    })

    it('should instantiate a callback', function() {
        const fileScript = `export const x = ()=>{return 0;}`;
        const { exported, recorder } = getExportedVariablesFromScript(fileScript, 'file5.ts');

        assert.lengthOf(exported, 1);

        const exportedVars = exported.get('x');
        assert.exists( exportedVars)

        assert.lengthOf(exportedVars, 1);

        const exportedVar = exportedVars[0];

        const exportedVarType = exportedVar.getType();

        // console.log(exportedVarType.getLiteralValue);
        assert.isFalse(exportedVar.getType().isLiteral());

        const ans = recorder.instantiateFakerOnType(exportedVarType);
        assert.isFunction(ans);
        assert.isNumber(ans());

    })

    it('should instantiate a buffer', function() {
        const fileScript = `export const x = Buffer.from('hello world');`;
        const { exported, recorder } = getExportedVariablesFromScript(fileScript, 'file6.ts');

        assert.lengthOf(exported, 1);

        const exportedVars = exported.get('x');
        assert.exists( exportedVars)

        assert.lengthOf(exportedVars, 1);

        const exportedVar = exportedVars[0];

        const exportedVarType = exportedVar.getType();

        // console.log(exportedVarType.getLiteralValue);
        assert.isFalse(exportedVar.getType().isLiteral());

        const ans = recorder.instantiateFakerOnType(exportedVarType);

        assert.isObject(ans);
        // assert.isNumber(ans());

    })


    function getExportedVariablesFromScript(fileScript,label) {
        const sourceFile = project.createSourceFile(label, fileScript);


        const exported = sourceFile.getExportedDeclarations();
        return { exported, recorder };
    }
})
