import angular from 'angular';
import Rx from 'rx';
import 'rx-dom';

import template from './gu-lazy-gallery.html!text';

import './gu-lazy-gallery.css!';

import '../../util/rx';

export var lazyGallery = angular.module('gu.lazyGallery', ['util.rx']);

function asInt(string) {
    return parseInt(string, 10);
}

lazyGallery.controller('GuLazyGalleryCtrl', [function() {
    let ctrl = this;

    ctrl.trackingData = action => ({
        'Action': action
    });

    ctrl.init = function({items$, totalItems$, preloadedItems$, currentIndex$}) {
        const itemsCount$ = items$.map(items => items.length).distinctUntilChanged();
        const totalItemsCount$ = totalItems$.map(totalItems => totalItems.length).distinctUntilChanged();

        const buttonCommands$ = Rx.Observable.create(observer => {
            ctrl.prevItem     = () => observer.onNext('prevItem');
            ctrl.nextItem     = () => observer.onNext('nextItem');

            // Make sure we start at the beginning
            observer.onNext('galleryStart');
        });


        const itemsOffset$ = buttonCommands$.combineLatest(
            itemsCount$,
            (command, itemsCount) => {
                return {command, itemsCount};
            }).withLatestFrom(
                currentIndex$,
                ({command, itemsCount}, currentIndex) => {
                    return {
                        prevItem:     -1,
                        nextItem:     +1,
                        galleryStart: currentIndex * -1,
                    }[command] || 0;
                }
            );




        const updatedIndex$ = itemsOffset$.withLatestFrom(
            currentIndex$, itemsCount$, totalItemsCount$,
            (itemsOffset, currentIndex, itemsCount, totalItemsCount) => {
                const updatedIndex = currentIndex + itemsOffset;
                // Update the index if it's in the range of items
                if (updatedIndex >= 0 && updatedIndex < totalItemsCount) {
                    return updatedIndex;
                } else {
                    return currentIndex;
                }
        });

        const item$ = updatedIndex$.withLatestFrom(
            totalItemsCount$, items$,
            (updatedIndex, totalItemsCount, items) => {
                currentIndex$.onNext(updatedIndex);
                return items[updatedIndex];
        });

        const currentPage$ = currentIndex$.withLatestFrom(
            preloadedItems$,
            (currentIndex, preloadedItems) => {
                return Math.floor(currentIndex / preloadedItems);
        });

        const rangeToLoad$ = currentPage$.withLatestFrom(
            preloadedItems$,
            (currentPage, preloadedItems) => {
                const start = currentPage * preloadedItems;
                const end = ((currentPage + 1) * preloadedItems) - 1;
            return {start, end};
        }).
            // Debounce range loading, which also helps discard
            // erroneous large ranges while combining
            // loadedRangeStart$ and loadedRangeEnd$ changes (one after the other)
            debounce(10).
            // Ignore if either end isn't set (whole range already loaded)
            filter(({start, end}) => start !== -1 && end !== -1).
            // Ignore if $start after $end (incomplete combine$ state)
            filter(({start, end}) => start <= end).
            distinctUntilChanged(({start, end}) => `${start}-${end}`);

        return {
            item$,
            rangeToLoad$
        };
    };

}]);

lazyGallery.directive('guLazyGallery', ['observe$', 'observeCollection$', 'subscribe$', 'inject$',
                                        function(
                                            observe$, observeCollection$, subscribe$, inject$) {
    return {
        restrict: 'E',
        controller: 'GuLazyGalleryCtrl',
        controllerAs: 'galleryCtrl',
        transclude: true,
        template: template,
        link: function(scope, element, attrs, ctrl) {
            // Map attributes as Observable streams
            const {
                guLazyGalleryItems:            itemsAttr,
                guLazyGalleryItemsTotal:       totalItemsAttr,
                guLazyGallerySelectionMode:    selectionMode,
                guLazyGalleryLoadRange:        loadRangeFn,
                guLazyGalleryPreloadedItems:   preloadedItemsAttr
            } = attrs;

            const items$          = observeCollection$(scope, itemsAttr);
            const selectionMode$  = observe$(scope, selectionMode);
            const totalItems$     = observe$(scope, totalItemsAttr);
            const preloadedItems$ = observe$(scope, preloadedItemsAttr).map(asInt);

            const currentIndex$ = new Rx.BehaviorSubject(0);

            const {item$, rangeToLoad$} = ctrl.init(
                {items$, totalItems$, preloadedItems$, currentIndex$}
            );

            subscribe$(scope, rangeToLoad$, range => {
                scope.$eval(loadRangeFn, range);
            });

            inject$(scope, currentIndex$, ctrl, 'currentIndex');
            inject$(scope, selectionMode$, ctrl, 'selectionMode');
            inject$(scope, item$, ctrl, 'item');
        }
    };
}]);
