import { INotebookTracker, NotebookPanel, Notebook, NotebookActions } from '@jupyterlab/notebook';
import { Cell, CodeCell } from '@jupyterlab/cells';
import { PartialJSONObject } from '@lumino/coreutils';
import { PathExt } from '@jupyterlab/coreutils';
import { Signal } from '@lumino/signaling';
import { ConnectionStatus, IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';


const NB_METADATA_KEY = 'scenes_data';
const SCENE_CELL_CLASS = 'scene-cell';


export class NotebookHandler {

    private _nbTracker;
    private _sceneDB: NotebookSceneDatabase;

    scenesChanged = new Signal(this);

    constructor(nbTracker: INotebookTracker) {
        this._nbTracker = nbTracker;
        this._sceneDB = new NotebookSceneDatabase(nbTracker)

        this._setupKernelListener();
    }

    /* ****************************************************************************************************************************************
     * Handle kernel (re-)starts
     * ****************************************************************************************************************************************/

    private _kernelStatusDict: { [id: string]: string; } = {};

    private _setupKernelListener() {
        this._nbTracker.widgetAdded.connect(async (sender, nbPanel) => {
            nbPanel!.context.sessionContext.ready.then(() => {
                this._kernelStatusDict[nbPanel.context.sessionContext.session!.kernel!.id] = 'connecting';
                nbPanel.context.sessionContext.session!.kernel!.connectionStatusChanged.connect((kernel, conn_stat) => { this._kernelListener(kernel, conn_stat); });
            });
        });
    }

    private _kernelListener(kernel: IKernelConnection, conn_stat: ConnectionStatus) {

        if(conn_stat == 'connecting') {
            this._kernelStatusDict[kernel.id] = 'connecting';
        } else if(conn_stat == 'connected') {
            if(this._kernelStatusDict[kernel.id] == 'connecting') {
                let notebookPanelList: NotebookPanel[] = [];
                this._nbTracker.forEach((nbPanel: NotebookPanel) => {
                    if(nbPanel!.context.sessionContext.session!.kernel!.id == kernel.id) { notebookPanelList.push(nbPanel); }
                });
                if(notebookPanelList.length > 0) {
                    let init_scene = this._sceneDB.getInitScene();
                    if(init_scene) this.runSceneInNotebook(notebookPanelList[0], init_scene);
                }
            }
            delete this._kernelStatusDict[kernel.id];
        }
    }

    /* ****************************************************************************************************************************************
     * Functionality provided to the main widget
     * ****************************************************************************************************************************************/
    
    // **** simple scene getters *************************************************
    getNotebookTitle() {
        return this._sceneDB.getNotebookTitle();
    }
    getScenesList() {
        return this._sceneDB.getScenesList();
    }
    getActiveScene(notebook:(Notebook|null)=null) {
        return this._sceneDB.getActiveScene(notebook)
    }
    getInitScene() {
        return this._sceneDB.getInitScene()
    }

    // **** scene setters ********************************************************
    toggleInitScene(scene_name: string) {
        this._sceneDB.toggleInitScene(scene_name);
        this._scenesChanged();
    }
    setActiveScene(scene_name: string) {
        this._sceneDB.setActiveScene(scene_name);
        this._scenesChanged();
    }
    renameScene(old_scene_name: string, new_scene_name: string): 'success' | 'fail' {
        const scenes_list = this.getScenesList();
        if(scenes_list.includes(new_scene_name)) return 'fail';

        if(this._sceneDB.getInitScene() == old_scene_name) {
            this._sceneDB.toggleInitScene(new_scene_name);
        }

        if(this._sceneDB.getActiveScene() == old_scene_name) {
            this._sceneDB.setActiveScene(new_scene_name);
        }

        let idx = scenes_list.lastIndexOf(old_scene_name);
        scenes_list[idx] = new_scene_name;
        this._sceneDB.setScenesList(scenes_list);
        this._renameSceneTagFromAllCells(this._nbTracker.currentWidget as NotebookPanel, old_scene_name, new_scene_name);
        this._scenesChanged();
        return 'success';
    }
    deleteScene(scene_name: string) {
        let scenes_list = this._sceneDB.getScenesList();
        if(scenes_list.length == 1) return;
        
        if(this._sceneDB.getInitScene() == scene_name) {
            this._sceneDB.toggleInitScene(scene_name);
        }

        let resetActiveScene = this._sceneDB.getActiveScene() == scene_name;
        this._removeSceneTagFromAllCells(this._nbTracker.currentWidget as NotebookPanel, scene_name);
        
        let idx = scenes_list.lastIndexOf(scene_name);
        scenes_list.splice(idx, 1);
        this._sceneDB.setScenesList(scenes_list);
        
        if(resetActiveScene) {
            if(idx < scenes_list.length) {
                this.setActiveScene(scenes_list[idx]);
            } else {
                this.setActiveScene(scenes_list[idx-1]);
            }
        }

        this._scenesChanged();
    }
    toggleSceneMembershipOfSelectedCells() {
        if(!this._nbTracker.currentWidget) return;
        if(!this._nbTracker.activeCell) return;

        const current_scene = this._sceneDB.getActiveScene();
        const is_init_scene = current_scene == this.getInitScene();
        const tag = 'scene__' + current_scene;
        const notebook = this._nbTracker.currentWidget.content;

        const set_membership = !this._nbTracker.activeCell.model.metadata.get(tag);

        notebook.widgets.forEach((cell: Cell) => {
            if(!notebook.isSelectedOrActive(cell)) return;
            if(cell.model.type != 'code') return;

            if(set_membership) {
                cell.model.metadata.set(tag, true);
                if(is_init_scene) {
                    cell.model.metadata.set('init_cell', true);
                }
            } else {
                cell.model.metadata.delete(tag);
                if(is_init_scene) {
                    cell.model.metadata.delete('init_cell');
                }
            }
            this._updateCellClassAndTags(cell, tag);
        });
    }

    // **** scene management and running *****************************************

    runActiveSceneInCurrentNotebook() {
        const active_scene = this._sceneDB.getActiveScene();
        if(active_scene) this.runSceneInCurrentNotebook(active_scene);
    }
    runSceneInCurrentNotebook(scene_name: string) {
        if(!this._nbTracker.currentWidget) return;
        const notebookPanel = this._nbTracker.currentWidget;
        this.runSceneInNotebook(notebookPanel, scene_name);
    }
    runSceneInNotebook(notebookPanel: NotebookPanel, scene_name: string) {
        const tag = this._getSceneTag(scene_name);
        notebookPanel.content.widgets.map((cell: Cell) => {
            if(!!cell.model.metadata.get(tag)) {
                if(cell.model.type == 'code') {
                    CodeCell.execute(cell as CodeCell, notebookPanel.sessionContext, {recordTiming: notebookPanel.content.notebookConfig.recordTiming});
                }
            }
        });
    }

    createNewEmptyScene(scene_name: string) : 'success' | 'fail' {
        const scene_list = this.getScenesList();
        if(scene_list.includes(scene_name)) return 'fail';

        scene_list.push(scene_name)
        this._sceneDB.setScenesList(scene_list);
        this._scenesChanged();
        
        return 'success'
    }
    duplicateActiveScene(new_scene_name: string): 'success' | 'fail' {
    
        let retval = this.createNewEmptyScene(new_scene_name);
        if(retval == 'fail') return 'fail';

        this._duplicateSceneTagInAllCells(this._nbTracker.currentWidget!, this.getActiveScene()!, new_scene_name);
        this._scenesChanged();
        return retval;
    }
    moveActiveSceneUp() {
        this._moveScene(this._sceneDB.getActiveScene()!, 'up');
        this._scenesChanged();
    }
    moveActiveSceneDown() {
        this._moveScene(this._sceneDB.getActiveScene()!, 'down');
        this._scenesChanged();
    }
    
    // **** various **************************************************************

    updateCellClassesAndTags(notebook: Notebook, scene_name:(string|null)=null, cell:(Cell|null)=null) {
        // console.log('updating', scene_name)

        if(scene_name == null) scene_name = this.getActiveScene()!;
        const scene_tag = this._getSceneTag(scene_name);

        if(cell == null) {
            notebook.widgets.map((cell: Cell) => {
                this._updateCellClassAndTags(cell, scene_tag);
            });
        } else {
            this._updateCellClassAndTags(cell, scene_tag);
        }

    }
    jumpToNextSceneCell() {
        const presentCell = this._nbTracker.activeCell;
        if(!presentCell) return;

        const tag = this._getSceneTag(this.getActiveScene()!);
        const cells = this._nbTracker.currentWidget!.content.widgets;
        let cellIdx = cells.indexOf(presentCell) as number;
        let numCells = cells.length as number;

        for(let n=cellIdx+1; n<numCells; n++) {
            let cell = cells[n];
            if(cell.model.metadata.get(tag)) {
                this._activateCellAndExpandParentHeadings(cell);
                break;
            }
        }
    }
    jumpToPreviousSceneCell() {
        const presentCell = this._nbTracker.activeCell;
        if(!presentCell) return;

        const tag = this._getSceneTag(this.getActiveScene()!);
        const cells = this._nbTracker.currentWidget!.content.widgets;
        let cellIdx = cells.indexOf(presentCell) as number;

        for(let n=cellIdx-1; n>=0; n--) {
            let cell = cells[n];
            if(cell.model.metadata.get(tag)) {
                this._activateCellAndExpandParentHeadings(cell);
                break;
            }
        }
    }
    importLegacyInitializationCells(notebook: Notebook) {

        let init_scenes_consistent = true;
        let legacy_init_cells_exist = false;
        let init_scene = this.getInitScene();
        let init_scene_tag = (init_scene != null) ? this._getSceneTag(init_scene) : null;

        // find out if there are legacy init cells and, if so, whether they are consistent with the scenes init cell
        notebook.widgets.map((cell: Cell) => {
            let is_legacy_init_cell = !!cell.model.metadata.get('init_cell');
            let is_scenes_init_cell = init_scene_tag != null && !!cell.model.metadata.get(init_scene_tag);
            if(is_legacy_init_cell) {
                legacy_init_cells_exist = true;
            }
            if(is_legacy_init_cell != is_scenes_init_cell) {
                init_scenes_consistent = false;
            }
        }); 
        
        if(!init_scenes_consistent && legacy_init_cells_exist) {
            const scene_name = 'Legacy Init';
            
            notebook.widgets.map((cell: Cell) => {
                let is_legacy_init_cell = !!cell.model.metadata.get('init_cell');
                if(is_legacy_init_cell) {
                    cell.model.metadata.set(this._getSceneTag(scene_name), true);
                }
            });

            const scene_list = this.getScenesList();
            if(!scene_list.includes(scene_name)) {
                scene_list.push(scene_name)
                this._sceneDB.setScenesList(scene_list);
            }
            this.toggleInitScene(scene_name);
            this.setActiveScene(scene_name);
        }
    }


    /* ****************************************************************************************************************************************
     * Various private helper methods
     * ****************************************************************************************************************************************/

    private _updateCellClassAndTags(cell: Cell, scene_tag: string) {
        let cell_tags: string[] = [];
        if(cell.model.metadata.has("tags")) {
            cell_tags = cell.model.metadata.get('tags') as string[];
        }

        if(!!cell.model.metadata.get(scene_tag)) {
            cell.addClass(SCENE_CELL_CLASS);
            if(!cell_tags.includes('ActiveScene')) cell_tags.push('ActiveScene');
        } else {
            cell.removeClass(SCENE_CELL_CLASS);
            if(cell_tags.includes('ActiveScene')) cell_tags.splice(cell_tags.indexOf('ActiveScene'), 1);
        }

        if(cell_tags.length > 0) {
            cell.model.metadata.set("tags", cell_tags);
        } else {
            cell.model.metadata.delete("tags");
        }

    }

    private _writeCellMetadataForLegacyInitializationCellsPlugin(notebook: Notebook) {

        let init_scene = this.getInitScene();
        let init_scene_tag = (init_scene != null) ? this._getSceneTag(init_scene) : null;

        notebook.widgets.map((cell: Cell) => {
            if(init_scene_tag != null && !!cell.model.metadata.get(init_scene_tag)) {
                cell.model.metadata.set('init_cell', true);
            } else {
                cell.model.metadata.delete('init_cell');
            }
        });
    }

    
    private _activateCellAndExpandParentHeadings(cell: Cell) {
        NotebookActions.expandParent(cell, this._nbTracker.currentWidget!.content);
        cell.activate();
    }

    private _moveScene(scene_name: string, direction: 'up'|'down') {
        const scenes_list = this.getScenesList();
        let idx = scenes_list.indexOf(scene_name);
        if(direction == 'down') {
            if(idx == scenes_list.length - 1) return;
        } else {  // direction = 'up'
            if(idx == 0) return;
            idx -= 1;
        }

        scenes_list.splice(idx, 2, scenes_list[idx+1], scenes_list[idx]);
        this._sceneDB.setScenesList(scenes_list);
    }

    private _removeSceneTagFromAllCells(nbPanel: NotebookPanel, scene_name: string) {
        const tag = this._getSceneTag(scene_name);
        const notebook = nbPanel.content;
        notebook.widgets.map((cell: Cell) => {
            if(!!cell.model.metadata.get(tag)) {
                cell.model.metadata.delete(tag);
            }
        });
    }

    private _renameSceneTagFromAllCells(nbPanel: NotebookPanel, old_scene_name: string, new_scene_name: string) {
        const old_tag = this._getSceneTag(old_scene_name);
        const new_tag = this._getSceneTag(new_scene_name);
        const notebook = nbPanel.content;
        notebook.widgets.map((cell: Cell) => {
            if(!!cell.model.metadata.get(old_tag)) {
                cell.model.metadata.delete(old_tag);
                cell.model.metadata.set(new_tag, true);
            }
        });
    }

    private _duplicateSceneTagInAllCells(nbPanel: NotebookPanel, source_scene_name: string, target_scene_name: string) {
        const source_tag = this._getSceneTag(source_scene_name);
        const target_tag = this._getSceneTag(target_scene_name);
        const notebook = nbPanel.content;
        notebook.widgets.map((cell: Cell) => {
            if(!!cell.model.metadata.get(source_tag)) {
                cell.model.metadata.set(target_tag, true);
            }
        });
    }

    private _scenesChanged() {
        
        const activeScene = this._sceneDB.getActiveScene();
        if(!activeScene) return;

        let activeNotebookPanel = this._nbTracker.currentWidget!;
        
        this._nbTracker.forEach((nbPanel) => {
            if(nbPanel.context === activeNotebookPanel.context) {
                this.updateCellClassesAndTags(nbPanel.content, activeScene);
            }
        });

        this._writeCellMetadataForLegacyInitializationCellsPlugin(activeNotebookPanel.content);

        this.scenesChanged.emit(void 0);
    }

    private _getSceneTag(scene_name: string) {
        return 'scene__' + scene_name;
    }
}


class NotebookSceneDatabase {
    private _nbTracker;

    constructor(nbTracker: INotebookTracker) {
        this._nbTracker = nbTracker;
    }

    /* ****************************************************************************************************************************************
     * Data access
     * ****************************************************************************************************************************************/

    // **** simple getters *************************************************
    getNotebookTitle(): string | null {
        if(!this._nbTracker.currentWidget) {
            return null;
        }
        return PathExt.basename(this._nbTracker.currentWidget.context.localPath);
    }
    getScenesList(): string[] {
        let data = this._getSceneDataAndMaybeSetupDefaultData();
        if(!data) return [];

        return data['scenes']
    }
    getActiveScene(notebook:(Notebook|null)=null): string | null {
        
        let data = this._getSceneDataAndMaybeSetupDefaultData(notebook);
        if(!data) return null;

        return data['active_scene'];
    }
    getInitScene(): string | null {
        let data = this._getSceneDataAndMaybeSetupDefaultData();
        if(!data) return null;

        return data['init_scene'];
    }

    // **** scene setters **************************************************
    toggleInitScene(scene_name: string) {
        let data = this._getSceneDataAndMaybeSetupDefaultData();
        if(!data) return
        if(data['init_scene'] == scene_name) {
            data['init_scene'] = null;
        } else {
            data['init_scene'] = scene_name;
        }
        this._setSceneData(data);
    }
    setActiveScene(scene_name: string) {
        let data = this._getSceneDataAndMaybeSetupDefaultData();
        if(!data) return
        data['active_scene'] = scene_name;
        this._setSceneData(data);
    }
    setScenesList(scene_list: string[]) {
        let data = this._getSceneDataAndMaybeSetupDefaultData();
        if(!data) return;
        data['scenes'] = scene_list;
        this._setSceneData(data);
    }

    /* ****************************************************************************************************************************************
     * Helpers
     * ****************************************************************************************************************************************/

    private _getSceneDataAndMaybeSetupDefaultData(notebook:(Notebook|null)=null) : {scenes: string[], active_scene: string, init_scene: string|null} | null {
        
        if(!notebook) {
            notebook = this._nbTracker.currentWidget!.content;
        }
        
        let metadata = notebook.model?.metadata;
        if(!metadata) {
            return null;
        }

        if(!metadata.has(NB_METADATA_KEY)) {
            //console.log('setting default scene data!!!!!!!!!!!')
            metadata.set(NB_METADATA_KEY, {scenes: ['Default Scene'], active_scene: 'Default Scene', init_scene: ''})
        }

        let data_json = (metadata.get(NB_METADATA_KEY) as PartialJSONObject);
        let retval = {
            scenes:        data_json['scenes'] as string[], 
            active_scene:  data_json['active_scene'] as string, 
            init_scene:    data_json['init_scene'] as string|null
        };
        
        return retval
    }

    private _setSceneData(scene_data: {scenes: string[], active_scene: string, init_scene: string|null}) {
        let metadata = this._nbTracker.currentWidget?.content.model?.metadata;
        if(!metadata) return;
        metadata.set(NB_METADATA_KEY, scene_data);
    }
};