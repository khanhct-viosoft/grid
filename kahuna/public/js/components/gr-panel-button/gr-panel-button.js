import angular from 'angular';
import template from './gr-panel-button.html!text';
import '../../util/rx';

export const panelButton = angular.module('gr.panelButton', ['util.rx']);

panelButton.controller('GrPanelButton', ['$scope', 'inject$', 'subscribe$', function($scope, inject$, subscribe$) {

    const ctrl = this;
    subscribe$($scope, ctrl.panel$, panel => {
        ctrl.hidePanel   = () => panel.setHidden(true);
        ctrl.showPanel   = () => panel.setHidden(false);
        ctrl.lockPanel   = () => panel.setLocked(true);
        ctrl.unlockPanel = () => panel.setLocked(false);

        // TODO: Could we have a helper to watch multiple streams?
        inject$($scope, panel.hidden$, ctrl, 'hidden');
        inject$($scope, panel.locked$, ctrl, 'locked');
    })
}]);

panelButton.directive('grPanelButton', [function() {
    return {
        restrict: 'E',
        template: template,
        bindToController: true,
        controller: 'GrPanelButton',
        controllerAs: 'ctrl',
        scope: {
            panel$: '=grPanel',
            position: '@grPosition'
        }
    }
}]);
