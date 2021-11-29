import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { Menu } from '@lumino/widgets';
import { ReactWidget, InputDialog, Dialog, showErrorMessage } from '@jupyterlab/apputils';

import React from 'react';

import { ScenesDisplay } from './components';
import { NotebookHandler } from './backend';



export class ScenesSidebar extends ReactWidget {
    constructor(app: JupyterFrontEnd, nbTracker: INotebookTracker, mainMenu: IMainMenu) {
        super();

        this._app = app;
        this._nbTracker = nbTracker;
        this._mainMenu = mainMenu;

        this._scenesMenu = null;
        this._notebookHandler = new NotebookHandler(nbTracker);

        this._setupWidget();
        this._setupGlobalCommands();
        this._setupKeyboardShortcuts();
        this._setupScenesMenu();

        this._nbTracker.currentChanged.connect((sender, nbpanel) => { this.onNotebookChanged(); });
        this._notebookHandler.scenesChanged.connect(() => { this.update(); });
    }

    render(): JSX.Element {

        let nb_title = this._notebookHandler.getNotebookTitle();
        if(!nb_title) return (<div />);
    
        return (
            <ScenesDisplay 
                nbTitle={nb_title} 
                scenes={this._notebookHandler.getScenesList()}
                currentScene={this._notebookHandler.getActiveScene()}
                initScene={this._notebookHandler.getInitScene()}
                commands={this._app.commands}
                notebookHandler={this._notebookHandler}/>
        )
    }

    onNotebookChanged() {
        this.update()
    }

    /* ****************************************************************************************************************************************
     * Private helper methods
     * ****************************************************************************************************************************************/

    // **** setup helpers ****************************************************************************************************************

    private _setupWidget() {
        this.id = 'scenes';
        this.title.caption = 'Scenes';
        this.title.label = 'Scenes';
    }

    private _setupGlobalCommands() {

        this._app.commands.addCommand(ScenesSidebar.command_id_toggle_scene_cell, {
            label: 'Toggle Scene Cell',
            execute: () => { this._notebookHandler.toggleSceneMembershipOfCurrentCell(); }
        });

        this._app.commands.addCommand(ScenesSidebar.command_id_run_scene, {
            label: 'Run Scene',
            execute: () => { this._notebookHandler.runActiveSceneInCurrentNotebook(); }
        });

        this._app.commands.addCommand(ScenesSidebar.command_id_new_empty_scene, {
            label: 'New Empty Scene',
            execute: () => { 
                InputDialog.getText({title: 'Name of the New Scene:'}).then( (new_scene) => {
                    if(!new_scene.value) return;
                    if(this._notebookHandler.createNewEmptyScene(new_scene.value) == 'fail') {
                        showErrorMessage('Error: New Scene Creation', 'Scene with name "' + new_scene.value + '" already exists!');
                    }
                });
            }
        });

        this._app.commands.addCommand(ScenesSidebar.command_id_duplicate_scene, {
            label: 'Duplicate Active Scene',
            execute: () => { 
                InputDialog.getText({title: 'Name of the Duplicated Scene:'}).then( (new_scene) => {
                    if(!new_scene.value) return;
                    if(this._notebookHandler.duplicateActiveScene(new_scene.value) == 'fail') {
                        showErrorMessage('Error: Scene Duplication', 'Scene with name "' + new_scene.value + '" already exists!');
                    }
                });
            }
        });

        this._app.commands.addCommand(ScenesSidebar.command_id_delete_scene, {
            label: 'Delete Scene',
            execute: async (scene_name_obj) => {
                let scene_name = scene_name_obj['scene_name'] as string;
                const result = await (new Dialog({
                    title: 'Delete Scene "' + scene_name + '" permanently?',
                    buttons: [Dialog.cancelButton(), Dialog.okButton({label: 'Delete'})]
                }).launch());

                if(result.button.label == 'Delete') {
                    this._notebookHandler.deleteScene(scene_name);
                }

            }
        });

        this._app.commands.addCommand(ScenesSidebar.command_id_rename_scene, {
            label: 'Rename Scene',
            execute: async (scene_name_obj) => {
                let scene_name = scene_name_obj['scene_name'] as string;

                InputDialog.getText({title: 'New Name of Scene "' + scene_name + '":'}).then( (new_scene_name) => {
                    if(!new_scene_name.value) return;
                    if(this._notebookHandler.renameScene(scene_name, new_scene_name.value) == 'fail') {
                        showErrorMessage('Error: Scene Renaming', 'Scene with name "' + new_scene_name.value + '" already exists!');
                    }
                })
            }
        });

        this._app.commands.addCommand(ScenesSidebar.command_id_move_active_scene_up, {
            label: 'Move Active Scene Up',
            execute: () => { this._notebookHandler.moveActiveSceneUp(); }
        });

        this._app.commands.addCommand(ScenesSidebar.command_id_move_active_scene_down, {
            label: 'Move Active Scene Down',
            execute: () => { this._notebookHandler.moveActiveSceneDown(); }
        });
    }

    private _setupKeyboardShortcuts() {
        this._app.commands.addKeyBinding({
            command: ScenesSidebar.command_id_toggle_scene_cell,
            args: {},
            keys: ['Accel I'],
            selector: '.jp-Notebook'
        });
        this._app.commands.addKeyBinding({
            command: ScenesSidebar.command_id_run_scene,
            args: {},
            keys: ['Ctrl Alt R'],
            selector: '.jp-Notebook'
        });
    }

    private _setupScenesMenu() {
        this._scenesMenu = new Menu({commands: this._app.commands});
        this._scenesMenu.title.label = 'Scenes';

        this._scenesMenu.addItem({command: ScenesSidebar.command_id_toggle_scene_cell});
        this._scenesMenu.addItem({command: ScenesSidebar.command_id_run_scene});
        this._scenesMenu.addItem({type: 'separator'});
        this._scenesMenu.addItem({command: ScenesSidebar.command_id_new_empty_scene});
        this._scenesMenu.addItem({command: ScenesSidebar.command_id_duplicate_scene});

        this._mainMenu.addMenu(this._scenesMenu);
    }

    /* ****************************************************************************************************************************************
     * Properties
     * ****************************************************************************************************************************************/

    private _app: JupyterFrontEnd;
    private _nbTracker: INotebookTracker;
    private _mainMenu: IMainMenu;

    private _scenesMenu: Menu | null;
    private _notebookHandler: NotebookHandler;
    
    static command_id_toggle_scene_cell =      'scenes:toggle-scene-cell';
    static command_id_run_scene =              'scenes:run-scene';
    static command_id_new_empty_scene  =       'scenes:new-empty-scene';
    static command_id_duplicate_scene =        'scenes:duplicate-scene';
    static command_id_rename_scene =           'scenes:rename-scene';
    static command_id_delete_scene =           'scenes:delete-scene';
    static command_id_move_active_scene_up =   'scenes:move-active-scene-up';
    static command_id_move_active_scene_down = 'scenes:move-active-scene-down';
};
