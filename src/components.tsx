import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';
import { NotebookHandler } from './backend';
import { runIcon, closeIcon, editIcon, addIcon, copyIcon } from '@jupyterlab/ui-components';
import { LabIcon } from '@jupyterlab/ui-components'


import { ScenesSidebar } from './widget';
import cellUp from '../style/svg/cellUp.svg';
import cellDown from '../style/svg/cellDown.svg';
import arrowUp from '../style/svg/arrowUp.svg';
import arrowDown from '../style/svg/arrowDown.svg';

const cellUpIcon = new LabIcon({name: 'cellUp', svgstr: cellUp});
const cellDownIcon = new LabIcon({name: 'cellDown', svgstr: cellDown});
const arrowUpIcon = new LabIcon({name: 'arrowUp', svgstr: arrowUp});
const arrowDownIcon = new LabIcon({name: 'arrowDown', svgstr: arrowDown});

export interface IPropertiesScenesDisplay {
  nbTitle: string;
  commands: CommandRegistry;
  scenes: string[];
  currentScene: string|null;
  initScene: string|null;
  notebookHandler: NotebookHandler;
}

interface IState {}

export class ScenesDisplay extends React.Component<IPropertiesScenesDisplay, IState> {

    render(): JSX.Element {
        return (
            <div className="scenes-ScenesSidebar">
                <div className="scenes-Header">{this.props.nbTitle}: Scenes</div>
                <Toolbar commands={this.props.commands}/>
                <ScenesList 
                    scenes={this.props.scenes} 
                    currentScene={this.props.currentScene} 
                    initScene={this.props.initScene} 
                    notebookHandler={this.props.notebookHandler}
                    commands={this.props.commands}/>
            </div>
        );
    }
}

interface IPropertiesScenesList {
    scenes: string[];
    currentScene: string|null;
    initScene: string|null;
    notebookHandler: NotebookHandler;
    commands: CommandRegistry;
}


class ScenesList extends React.Component<IPropertiesScenesList, IState> {


    render(): JSX.Element {

        
        let list: JSX.Element[] = this.props.scenes.map( scene_name => {

            const onClickActivate = () => {
                this.props.notebookHandler.setActiveScene(scene_name);
            }

            const onClickDelete = (event: React.SyntheticEvent<HTMLSpanElement>) => {
                event.preventDefault();
                event.stopPropagation();
                this.props.commands.execute(ScenesSidebar.command_id_delete_scene, {'scene_name': scene_name});
            }

            const onClickEdit = (event: React.SyntheticEvent<HTMLSpanElement>) => {
                event.preventDefault();
                event.stopPropagation();
                this.props.commands.execute(ScenesSidebar.command_id_rename_scene, {'scene_name': scene_name});
            }

            const onClickInit = (event: React.SyntheticEvent<HTMLSpanElement>) => {
                event.preventDefault();
                event.stopPropagation();
                this.props.notebookHandler.toggleInitScene(scene_name);
            }

            const onClickRun = (event: React.SyntheticEvent<HTMLSpanElement>) => {
                event.preventDefault();
                event.stopPropagation();
                this.props.notebookHandler.runSceneInCurrentNotebook(scene_name);
            }
            
            let active = this.props.currentScene == scene_name;
            let init = this.props.initScene == scene_name;
            let className = active ? "scenes-SceneItem scenes-active" : "scenes-SceneItem";
            let classNameInitButton = init ? "scenes-InitSceneButtonActive" : "scenes-InitSceneButton";
            let sceneNameDisplay = active ? "  " + scene_name + " (active)" : "  " + scene_name;
                        
            return (
                <div className={className} onClick={onClickActivate} key={scene_name}>
                    <button className="scenes-ItemButton" title="Delete Scene" onClick={onClickDelete}><closeIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                    <button className="scenes-ItemButton" title="Run Scene" onClick={onClickRun}><runIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                    <button className="scenes-ItemButton" title="Rename Scene" onClick={onClickEdit}><editIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                    <div className="scenes-ItemText">{sceneNameDisplay}</div>
                    <div className="scenes-SceneItemSpacer"></div>
                    <button onClick={onClickInit} className={classNameInitButton}>init</button>
                </div>
            );
        });

        return (
            <div className="scenes-SceneList">
                {list}
            </div>
        );
    }

}


interface IPropertiesToolbar {
    commands: CommandRegistry;
}

class Toolbar extends React.Component<IPropertiesToolbar, IState> {

    render(): JSX.Element {

        const onClickNew = () => { 
            this.props.commands.execute(ScenesSidebar.command_id_new_empty_scene)
        }

        const onClickDuplicate = () => { 
            this.props.commands.execute(ScenesSidebar.command_id_duplicate_scene)
        }

        const onClickUp = () => { 
            this.props.commands.execute(ScenesSidebar.command_id_move_active_scene_up)
        }

        const onClickDown = () => { 
            this.props.commands.execute(ScenesSidebar.command_id_move_active_scene_down)
        }

        const onClickNext = () => {
            this.props.commands.execute(ScenesSidebar.command_id_to_next_scene_cell)
        }
       
        const onClickPrev = () => {
            this.props.commands.execute(ScenesSidebar.command_id_to_previous_scene_cell)
        }
       
        return (
            <div className="scenes-Toolbar">
                <button className="scenes-ToolbarButton" title="New Empty Scene" onClick={onClickNew}><addIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                <button className="scenes-ToolbarButton" title="Duplicate Active Scene" onClick={onClickDuplicate}><copyIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                <button className="scenes-ToolbarButton" title="Move Active Scene Up" onClick={onClickUp}><arrowUpIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                <button className="scenes-ToolbarButton" title="Move Active Scene Down" onClick={onClickDown}><arrowDownIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                <div className="scenes-SceneItemSpacer"></div>
                <button className="scenes-ToolbarButton" title="Jump to Next Scene Cell" onClick={onClickNext}><cellDownIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
                <button className="scenes-ToolbarButton" title="Move to Previous Scene Cell" onClick={onClickPrev}><cellUpIcon.react tag="span" className="jp-ToolbarButtonComponent-icon f1vya9e0"/></button>
            </div>
        );
    }

}