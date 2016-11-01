angular.module('orderCloud')

    .config(ProductsConfig)
    .controller('ProductsCtrl', ProductsController)
    .controller('ProductEditCtrl', ProductEditController)
    .controller('ProductCreateCtrl', ProductCreateController)
    .controller('ProductAssignmentsCtrl', ProductAssignmentsController)
    .controller('ProductCreateAssignmentCtrl', ProductCreateAssignmentController)
    .controller('PriceScheduleModalCtrl', PriceScheduleModalController)
    .controller('EditBuyerAssignmentCtrl', EditBuyerAssignmentController)
    .controller('ProductsModalCtrl', ProductsModalController)
    .factory('ProductService', ProductService)
    .filter('productgroupfilter', productgroupfilter)
    .directive('scenarioProductCreate', scenarioProductCreate)


;

function ProductsConfig($stateProvider) {
    $stateProvider
        .state('products', {
            parent: 'base',
            url: '/products',
            templateUrl: 'products/templates/products.tpl.html',
            controller: 'ProductsCtrl',
            controllerAs: 'products',
            data: {componentName: 'Products'},
            resolve: {
                ProductList: function (ProductService) {
                    return ProductService.GetAllProducts();
                },
                BuyerList: function(BuyerService) {
                    return BuyerService.GetAllBuyers();
                }
            }
        })
        .state('products.edit', {
            url: '/:productid/edit/:buyerid',
            templateUrl: 'products/templates/productEdit.tpl.html',
            controller: 'ProductEditCtrl',
            controllerAs: 'productEdit',
            resolve: {
                SelectedProduct: function ($stateParams, OrderCloud) {
                    return OrderCloud.Products.Get($stateParams.productid);
                }
            }
        })
        .state('products.create', {
            url: '/create/:buyerid',
            templateUrl: 'products/templates/productCreate.tpl.html',
            controller: 'ProductCreateCtrl',
            controllerAs: 'productCreate',
            resolve: {
                PriceScheduleList: function(OrderCloud, Underscore) {
                    return OrderCloud.PriceSchedules.List()
                        .then(function(data) {
                            data.Items = Underscore.filter(data.Items, function(item) {return item.Name.indexOf('FedExFranchise') > -1});
                            return data;
                        });
                },
                RetailProfileList: function(OrderCloud) {
                    return OrderCloud.UserGroups.List();
                }
            }
        })
        .state('products.assignments', {
            url: '/:productid/assignments',
            templateUrl: 'products/templates/productAssignments.tpl.html',
            controller: 'ProductAssignmentsCtrl',
            controllerAs: 'productAssignments',
            resolve: {
                SelectedProduct: function($stateParams, OrderCloud) {
                    return OrderCloud.Products.Get($stateParams.productid);
                },
                Assignments: function($stateParams, OrderCloud) {
                    return OrderCloud.Products.ListAssignments($stateParams.productid);
                }
            }
        })
        .state('products.createAssignment', {
            url: '/:productid/assignments/new',
            templateUrl: 'products/templates/productCreateAssignment.tpl.html',
            controller: 'ProductCreateAssignmentCtrl',
            controllerAs: 'productCreateAssignment',
            resolve: {
                UserGroupList: function (OrderCloud) {
                    return OrderCloud.UserGroups.List(null, 1, 20);
                },
                PriceScheduleList: function (OrderCloud) {
                    return OrderCloud.PriceSchedules.List(1, 20);
                }
            }
        });
}

function productgroupfilter() {
    return function(products, searchTerm) {
        var result = [];
        angular.forEach(products, function(product) {

            if (searchTerm == 'Global') {
                if (product.xp.Global) {
                    result.push(product);
                }
            } else if (searchTerm == 'Unassigned') {
                if (!product.xp || !product.xp.Global && !product.xp.BuyerID) {
                    result.push(product);
                }
            } else if (product.xp.BuyerID == searchTerm) {
                result.push(product);
            } else {
                angular.noop();
            }
        });
        return result;
    }
}

function ProductService(OrderCloud, $q, Underscore) {
    var service = {
        GetAllProducts: _getAllProducts
    };



    function _getAllProducts() {
        var deferred = $q.defer();

        var queue = [];

        OrderCloud.Products.List(null, 1, 1)
            .then(function(data) {
                for (var i = 1; i <= data.Meta.TotalPages; i++) {
                    queue.push(function() {
                        var d = $q.defer();
                        OrderCloud.Products.List(null, i, 1)
                            .then(function(data) {
                                d.resolve(data.Items);
                            });
                        return d.promise;
                    }());
                }
                $q.all(queue)
                    .then(function(data) {
                        var returnArray = [];
                        data.forEach(function(each) {
                            each.forEach(function(product) {
                                returnArray.push(product);
                            })
                        });
                        deferred.resolve(returnArray);
                    })
            });
        return deferred.promise;
    }

    return service;
}

function ProductsModalController(ProductList, $uibModalInstance, CurrentBuyer, Underscore, $state, $uibModal) {
    var vm = this;
    vm.ProductList = ProductList;
    vm.CurrentBuyer = CurrentBuyer;
    vm.ProductList = Underscore.filter(vm.ProductList, function(prod) {
        if (!prod.xp.BuyerID && !prod.xp.Global && CurrentBuyer.ID == 'Unassigned') {
            console.log('Unassigned');
            return true;
        } else if (prod.xp.Global && CurrentBuyer.ID == 'Global') {
            console.log('Global');
            return true;
        } else if (prod.xp.BuyerID == CurrentBuyer.ID) {
            console.log(CurrentBuyer.ID);
            return true;
        } else {
            return false;
        }
    });
    vm.editProduct = function(productid, buyerid) {
        $uibModalInstance.dismiss();
        $state.go('products.edit', {buyerid: buyerid, productid: productid})
    };
    vm.newProduct = function(buyerid) {
        $uibModalInstance.dismiss();
        $state.go('products.create', {buyerid: buyerid})
    };
    vm.cancel = function() {

        $uibModalInstance.dismiss();
    };
    vm.onBuyerEdit = false;
    vm.editBuyerAssignment = function(scope) {
        vm.onBuyerEdit = true;
        $uibModal.open({
            animation: true,
            templateUrl: 'products/templates/editBuyerAssignment.modal.tpl.html',
            controller: 'EditBuyerAssignmentCtrl',
            controllerAs: 'baModal',
            size: 'lg',
            resolve: {
                BuyersList: function() {
                    return vm.BuyerList;
                },
                CurrentBuyer: function() {
                    return scope.$parent.buyer;
                }
            }
        }).result
            .then(function(newBuyer) {
                vm.onBuyerEdit = false;
                if (newBuyer.ID == 'Global') {
                    scope.product.xp.BuyerID = null;
                    scope.product.xp.Global = true;
                } else {
                    scope.product.xp.BuyerID = newBuyer.ID;
                    scope.product.xp.Global = false;
                }
                OrderCloud.Products.Update(scope.product.ID, scope.product)
                    .then(function() {
                        $state.reload();
                    })

            })
    };
}

function EditBuyerAssignmentController($uibModalInstance, BuyersList, CurrentBuyer) {
    var vm = this;
    vm.cancel = function() {

        $uibModalInstance.dismiss();
    };
    vm.buyers = BuyersList;
    vm.selectedBuyer = CurrentBuyer;
    vm.selectBuyer = function(scope) {
        vm.selectedBuyer = scope.buyer;
    };

    vm.confirm = function() {
        $uibModalInstance.close(vm.selectedBuyer);
    }
}

function ProductsController(TrackSearch, ProductList, BuyerList, Underscore, BuyerService, $state, $uibModal, OrderCloud) {
    var vm = this;

    vm.ProductList = ProductList;
    vm.BuyerList = BuyerList;
    vm.BuyerList.unshift({
        ID: 'Global',
        Name: 'Global Products',
        Active: true
    });
    vm.BuyerList.push({
        ID: 'Unassigned',
        Name: 'Unassigned Products',
        Active: true
    });
    vm.BuyerProducts = {};
    angular.forEach(vm.BuyerList, function(buyer) {
        vm.BuyerProducts[buyer.ID] = Underscore.filter(vm.ProductList, function(prod){return prod.xp && prod.xp.BuyerID == buyer.ID;})
    });
    vm.BuyerProducts['Global'] = Underscore.filter(vm.ProductList, function(prod){return prod.xp && prod.xp.Global == true;});
    vm.BuyerProducts['Unassigned'] = Underscore.filter(vm.ProductList, function(prod) {return !prod.xp || !prod.xp.Global && !prod.xp.BuyerID;});

    vm.mappings = {
        'Global': {
            Name: 'Global Products',
            Description: 'These Products are available to all buyers',
            Logo: 'assets/fedex.png'
        },
        'Boeing': {
            Name: 'Boeing',
            Description: 'Boeing Online Print Portal',
            Logo: 'assets/Boeing.png'
        },
        'FedExFranchiseBuyer': {
            Name: "Chili's Restaurant",
            Description: "Chili's Online Marketing Campaigns and Print Portal",
            Logo: 'assets/chilis.jpg'
        },
        'fedexBuyer': {
            Name: 'Global Products',
            Description: 'These Products are available to all buyers',
            Logo: 'assets/fedex.png'
        },
        'Marketing': {
            Name: 'Blue Buffalo Marketing',
            Description: 'Marketing Portal For Blue Buffalo Pet Food',
            Logo: 'assets/blue.png'
        },
        'MedicalComplianceConsultingFirm': {
            Name: 'The Fox Group, LLC',
            Description: 'Marketing Material Portal and Content Generator',
            Logo: 'assets/foxgrp.png'
        },
        'Training': {
            Name: 'Blue Buffalo Training',
            Description: 'Training Dept. Portal for Blue Buffalo Training Team',
            Logo: 'assets/blue.png'
        },
        'Unassigned': {
            Name: 'Unassigned',
            Description: 'These Products have yet to be assigned to an environment',
            Logo: 'assets/fedex.png'
        }
    }

    vm.newProduct = function(buyerid) {
        $state.go('products.create', {buyerid: buyerid})
    };

    vm.FilterOnBuyer = function(buyer) {
        vm.oneBuyerSelected = true;
        vm.BuyerSelected = buyer;
    };
    vm.UnfilterBuyers = function() {
        vm.oneBuyerSelected = false;
        vm.BuyerSelected = null;
    };
    vm.searchBuyers = function(searchVal) {
        var result = BuyerService.SearchBuyers(BuyerList, searchVal);
        vm.testmax = result;
        return result

    };



    vm.productModal = function(scope, buyer) {
        $uibModal.open({
            animation: true,
            templateUrl: 'products/templates/product.modal.tpl.html',
            controller: 'ProductsModalCtrl',
            controllerAs: 'pModal',
            size: 'lg',
            resolve: {
                BuyersList: function() {
                    return vm.BuyerList;
                },
                CurrentBuyer: function() {
                    return buyer;
                },
                ProductList: function() {
                    return vm.ProductList;
                }
            }
        })
    }
}



function ProductEditController($exceptionHandler, $state, OrderCloud, SelectedProduct, $stateParams, $scope, SpecService, AdminUserService, $q, Underscore) {
    var vm = this,
        productid = angular.copy(SelectedProduct.ID);
    vm.noReroute = false;
    vm.buyerid = $stateParams.buyerid;
    vm.productName = angular.copy(SelectedProduct.Name);
    vm.product = SelectedProduct;
    console.log(vm.product);
    vm.productSpecs = [];
    vm.product.xp.Global = vm.product.xp.Global ? vm.product.xp.Global : false;
    vm.product.xp.BuyerID = vm.product.xp.BuyerID ? vm.product.xp.BuyerID : null;
    vm.product.xp.FulfilledInternally = vm.product.xp.FulfilledInternally ? vm.product.xp.FulfilledInternally : false;
    vm.product.xp.FulfilledBy = vm.product.xp.FulfilledBy ? vm.product.xp.FulfilledBy : null;
    vm.product.xp.RerouteSupplier = vm.product.xp.RerouteSupplier ? vm.product.xp.RerouteSupplier : null;

    SpecService.GetAllSpecs()
        .then(function(data) {
            vm.specList = data;
        });
    AdminUserService.GetAllSuppliers()
        .then(function(data) {
            vm.suppliers = data;

        });

    SpecService.GetAssignedSpecs(productid)
        .then(function(data) {
            angular.forEach(data, function(assignment) {
                OrderCloud.Specs.Get(assignment.SpecID)
                    .then(function(data) {
                        vm.productSpecs.push(data);
                    })
            })
        });

    vm.Submit = function () {
        OrderCloud.Products.Update(productid, vm.product)
            .then(function (data) {
                MaxsMagic(data)
                    .then(function() {
                        $state.go('products', {}, {reload:true})
                    });
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    function MaxsMagic(data) {
        var d = $q.defer();
        var queue = [];
        if (!vm.productSpecs.length) {
            d.resolve();
        }
        vm.productSpecs.forEach(function(spec) {
            queue.push(function() {
                var dd = $q.defer();
                OrderCloud.Specs.SaveProductAssignment({SpecID: spec.ID, ProductID: data.ID})
                    .then(function() {
                        dd.resolve()
                    }, function(ex) {
                        dd.reject(ex);
                    });
                return dd.promise;
            }());
            $q.all(queue)
                .then(function() {
                    d.resolve();
                }, function(ex) {
                    d.reject(ex);
                })
        });
        return d.promise;
    }

    vm.Delete = function () {
        OrderCloud.Products.Delete(productid)
            .then(function () {
                $state.go('products', {}, {reload:true})
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    $scope.$watch(function() {
        return vm.product.xp.FulfilledInternally;
    }, function(newval, oldval) {
        if (newval) {
            vm.product.xp.FulfilledBy = null;
        }
    });

    $scope.$watch(function() {
        return vm.noReroute;
    }, function(newval, oldval) {
        if (newval) {
            vm.product.xp.RerouteSupplier = null;
        }
    });



    vm.addSpec = function() {
        if (vm.productSpecs.indexOf(vm.NewSpec) > -1) {
            angular.noop();
        } else {
            vm.productSpecs.push(vm.NewSpec);
        }
        vm.NewSpec = "";
        vm.showNewSpecInput = false;
    };

    vm.removeSpec = function(spec, index) {
        OrderCloud.Specs.DeleteProductAssignment(spec.ID, productid)
            .then(function() {
                vm.productSpecs.splice(index, 1);
            })
    };

    switch(vm.buyerid) {
        case 'Boeing':
            vm.product.xp.NeedsApproval = vm.product.xp.NeedsApproval ? vm.product.xp.NeedsApproval : false;
            break;
        case 'FedExFranchiseBuyer':
            vm.product.xp.Mandatory = vm.product.xp.Mandatory ? vm.product.xp.Mandatory : false;
            vm.product.xp.PlacementInstructions = vm.product.xp.PlacementInstructions ? vm.product.xp.PlacementInstructions : '';
            break;
        case 'MedicalComplianceConsultingFirm':
            vm.product.xp.document = vm.product.xp.document ? vm.product.xp.document : {};
            vm.product.xp.Type = vm.product.xp.Type ? vm.product.xp.Type : '';
            break;
        default:
            angular.noop();

    }


}

function scenarioProductCreate() {
    var directive = {
        scope: {
            buyerid: '=',
            model: '='
        },
        controller: ['$scope', function($scope) {
            var vm = this;
            vm.buyerid = $scope.buyerid;
            vm.model = $scope.model;
        }],
        controllerAs: 'scenario',
        restrict: 'E',
        templateUrl: 'products/templates/productCreate.scenarios.directives.tpl.html'
    };

    return directive;

};

function ProductCreateController($exceptionHandler, $state, OrderCloud, $stateParams, $scope, AdminUserService, SpecService, PriceScheduleList, RetailProfileList, $q, Underscore) {
    var vm = this;
    vm.noReroute = false;
    vm.buyerid = $stateParams.buyerid;
    vm.productSpecs = [];
    SpecService.GetAllSpecs()
        .then(function(data) {
            vm.specList = data;
        });
    AdminUserService.GetAllSuppliers()
        .then(function(data) {
            vm.suppliers = data;
        });
    vm.product = {
        xp : {
            Global: vm.buyerid == 'Global',
            BuyerID: vm.buyerid == 'Global' ? null : vm.buyerid,
            FulfilledInternally: false,
            FulfilledBy: null,
            RerouteSupplier: null
        }
    };


    //from rob for s2
    vm.retailProfiles = RetailProfileList;
    vm.priceSchedules = PriceScheduleList;
    vm.assignment = {
        "BuyerID": vm.buyerid,
        "ProductID": null,
        "StandardPriceScheduleID": null,
        "UserGroupID": null
    };

    vm.selectPriceSchedule = function(scope) {
        vm.assignment.StandardPriceScheduleID == scope.priceSchedule.ID ? vm.assignment.StandardPriceScheduleID = null : vm.assignment.StandardPriceScheduleID = scope.priceSchedule.ID;
    };

    vm.toggleRetailProfile = function(scope) {
        scope.profile.Selected = !scope.profile.Selected;
    };

    vm.newPriceSchedule = function() {
        $uibModal.open({
            animation: true,
            templateUrl: 'products/templates/newPriceSchedule.modal.tpl.html',
            controller: 'PriceScheduleModalCtrl',
            controllerAs: 'psModal',
            size: 'lg'
        }).result
            .then(function(data) {
                vm.priceSchedules.Items.push(data);
                vm.assignment.StandardPriceScheduleID = data.ID;
            })
    };


    vm.Submit = function () {
        if (vm.buyerid == 'FedExFranchiseBuyer') {
            OrderCloud.Products.Create(vm.product)
                .then(function (data) {
                    MaxsMagic(data)
                        .then(function() {
                            RobsMagic(data);
                        },
                        function(ex) {
                            $exceptionHandler(ex);
                        });
                })
                .catch(function(ex) {
                    $exceptionHandler(ex)
                });
        } else {
            OrderCloud.Products.Create(vm.product)
                .then(function (data) {
                    MaxsMagic(data)
                        .finally(function() {
                            $state.go('products', {}, {reload:true})
                        })

                })
                .catch(function(ex) {
                    $exceptionHandler(ex)
                });
        }

    };

    function RobsMagic(data) {
        var queue = [];
        vm.assignment.ProductID = data.ID;
        angular.forEach(Underscore.where(vm.retailProfiles.Items, {'Selected':true}), function(profile) {
            var assignment = angular.copy(vm.assignment);
            assignment.UserGroupID = profile.ID;
            queue.push(OrderCloud.Products.SaveAssignment(assignment));
        });
        $q.all(queue).then(function() {
            $state.go('products', {}, {reload:true})
        });
    }

    function MaxsMagic(data) {
        var d = $q.defer();
        var queue = [];
        if (!vm.productSpecs.length) {
            d.resolve();
        }
        vm.productSpecs.forEach(function(spec) {
            queue.push(function() {
                var dd = $q.defer();
                OrderCloud.Specs.SaveProductAssignment({SpecID: spec.ID, ProductID: data.ID})
                    .then(function() {
                        dd.resolve()
                    }, function(ex) {
                        dd.reject(ex);
                    });
                return dd.promise;
            }());
            $q.all(queue)
                .then(function() {
                    d.resolve();
                }, function(ex) {
                    d.reject(ex);
                })
        });
        return d.promise;
    }

    vm.addSpec = function() {
        if (vm.productSpecs.indexOf(vm.NewSpec) > -1) {
            angular.noop();
        } else {
            vm.productSpecs.push(vm.NewSpec);
        }
        vm.NewSpec = "";
        vm.showNewSpecInput = false;
    };
    vm.removeSpec = function(index) {
        vm.productSpecs.splice(index, 1);
    };




    $scope.$watch(function() {
        return vm.product.xp.FulfilledInternally;
    }, function(newval, oldval) {
        if (newval) {
            vm.product.xp.FulfilledBy = null;
        }
    });

    $scope.$watch(function() {
        return vm.noReroute;
    }, function(newval, oldval) {
        if (newval) {
            vm.product.xp.RerouteSupplier = null;
        }
    });

    switch(vm.buyerid) {
        case 'Boeing':
            vm.product.xp.NeedsApproval = false;
            break;
        case 'FedExFranchiseBuyer':
            vm.product.xp.Mandatory = false;
            vm.product.xp.PlacementInstructions = '';
            break;
        case 'MedicalComplianceConsultingFirm':
            vm.product.xp.document = {};
            vm.product.xp.Type = '';
            break;
        default:
           angular.noop();

    }
}

function PriceScheduleModalController($uibModalInstance, PriceBreak, OrderCloud) {
    var vm = this;
    vm.priceSchedule = {};
    vm.priceSchedule.RestrictedQuantity = false;
    vm.priceSchedule.PriceBreaks = new Array();

    vm.addPriceBreak = function() {
        PriceBreak.addPriceBreak(vm.priceSchedule, vm.price, vm.quantity);
        vm.quantity = null;
        vm.price = null;
    };

    vm.deletePriceBreak = PriceBreak.deletePriceBreak;

    vm.Submit = function() {
        vm.priceSchedule = PriceBreak.setMinMax(vm.priceSchedule);
        OrderCloud.PriceSchedules.Create(vm.priceSchedule)
            .then(function(data) {
                $uibModalInstance.close(data);
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    vm.cancel = function() {
        $uibModalInstance.close();
    }
}

function ProductAssignmentsController($exceptionHandler, $stateParams, $state, OrderCloud, SelectedProduct, Assignments) {
    var vm = this;
    vm.list = Assignments.Items;
    vm.productID = $stateParams.productid;
    vm.productName = angular.copy(SelectedProduct.Name);
    vm.pagingfunction = PagingFunction;

    vm.Delete = function(scope) {
        OrderCloud.Products.DeleteAssignment($stateParams.productid, null, scope.assignment.UserGroupID)
            .then(function() {
                $state.reload();
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            })
    }

    function PagingFunction() {
        if (vm.list.Meta.Page < vm.list.Meta.TotalPages) {
            OrderCloud.Products.ListAssignments($stateParams.productid, null, null, null, null, vm.list.Meta.Page + 1, vm.list.Meta.PageSize)
                .then(function(data) {
                    vm.list.Items = [].concat(vm.list.Items, data.Items);
                    vm.list.Meta = data.Meta;
                });
        }
    }
}

function ProductCreateAssignmentController($q, $stateParams, $state, Underscore, OrderCloud, UserGroupList, PriceScheduleList) {
    var vm = this;
    vm.list = UserGroupList;
    vm.priceSchedules = PriceScheduleList.Items;
    vm.assignBuyer = false;
    vm.model = {
        ProductID:$stateParams.productid,
        BuyerID: OrderCloud.BuyerID.Get(),
        UserGroupID: null,
        StandardPriceScheduleID: null,
        ReplenishmentPriceScheduleID: null
    };

    vm.toggleReplenishmentPS = function(id) {
        vm.model.ReplenishmentPriceScheduleID == id ? vm.model.ReplenishmentPriceScheduleID = null : vm.model.ReplenishmentPriceScheduleID = id;
    };

    vm.toggleStandardPS = function(id) {
        vm.model.StandardPriceScheduleID == id ? vm.model.StandardPriceScheduleID = null : vm.model.StandardPriceScheduleID = id;
    };

    vm.submit = function() {
        if (!(vm.model.StandardPriceScheduleID || vm.model.ReplenishmentPriceScheduleID) || (!vm.assignBuyer && !Underscore.where(vm.list.Items, {selected:true}).length)) return;
        if (vm.assignBuyer) {
            OrderCloud.Products.SaveAssignment(vm.model).then(function() {
                $state.go('base.productAssignments', {productid:$stateParams.productid});
            })
        } else {
            var assignmentQueue = [];
            angular.forEach(Underscore.where(vm.list.Items, {selected:true}), function(group) {
                assignmentQueue.push((function() {
                    var df = $q.defer();
                    var assignment = angular.copy(vm.model);
                    assignment.UserGroupID = group.ID;
                    OrderCloud.Products.SaveAssignment(assignment).then(function() {
                        df.resolve();
                    });
                    return df.promise;
                })())
            });
            $q.all(assignmentQueue).then(function() {
                $state.go('base.productAssignments', {productid:$stateParams.productid});
            })
        }
    };
}

