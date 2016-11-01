angular.module( 'orderCloud' )

    .config( OrdersConfig )
    .controller( 'OrdersCtrl', OrdersController )
    .controller( 'OrderEditCtrl', OrderEditController )
    .controller( 'ChangeFulfillmentCtrl', ChangeFulfillmentCtrl )
    .controller( 'FulfillLineItemCtrl', FulfillLineItemCtrl )
    .controller( 'ProofModalCtrl', ProofModalCtrl )
    .factory( 'OrdersTypeAheadSearchFactory', OrdersTypeAheadSearchFactory )
    .filter( 'fulfilledByOrders', fulfilledByOrders)
    .filter( 'validFulfiller', validFulfiller)
;

function fulfilledByOrders(Underscore) {
    return function(orders, user) {
        switch(user.xp.UserType) {
            case 'Supplier':
                return Underscore.filter(orders, function(order){return order.FulFilledByOther.indexOf(user.ID) > -1});
                break;
            default:
                return orders;
        }
    }
}

function validFulfiller(Underscore) {
    return function(lineitems, userID) {
        if (userID.indexOf('supplier') > -1) {
            return Underscore.filter(lineitems, function(li) {
                if (li.xp && li.xp.FulfillOverride) {
                    return li.xp.FulfillOverride.ID == userID;
                } else {
                    return li.Product.xp.FulfilledBy == userID;
                }
            })
        } else {
            return lineitems;
        }
    }
}

function OrdersConfig( $stateProvider ) {
    $stateProvider
        .state( 'orders', {
            parent: 'base',
            url: '/orders',
            templateUrl:'orders/templates/orders.tpl.html',
            controller:'OrdersCtrl',
            controllerAs: 'orders',
            data: {componentName: 'Orders'},
            resolve: {
                OrderList: function($q, $resource, OrderCloud, Underscore ) {
                    return OrderCloud.Orders.List('incoming', null, null, null, null, null, null, null, {'Status':'!Completed'})
                        .then(function(data) {
                            var d = $q.defer();
                            var queue = [];
                            angular.forEach(data.Items, function(order) {
                                queue.push(OrderCloud.LineItems.List(order.ID)
                                    .then(function(lidata) {
                                        var pd = $q.defer();
                                        var productQueue = [];
                                        order.FulFilledByOther = [];
                                        angular.forEach(lidata.Items, function(li) {
                                            if (li.xp && li.xp.FulfillOverride && li.xp.FulfillOverride.ID && order.FulFilledByOther.indexOf(li.xp.FulfillOverride.ID) == -1) {
                                                order.FulFilledByOther.push(li.xp.FulfillOverride.ID);
                                            }
                                            productQueue.push(OrderCloud.Products.Get(li.ProductID));
                                        });
                                        $q.all(productQueue)
                                            .then(function(results) {
                                                var fulfilledByProducts = Underscore.filter(results, function(product) {
                                                    return product.xp.FulfilledBy;
                                                });
                                                if (fulfilledByProducts.length) {
                                                    angular.forEach(fulfilledByProducts, function(p) {
                                                        if(p.xp && p.xp.FulfilledBy && order.FulFilledByOther.indexOf(p.xp.FulfilledBy) == -1 ) {
                                                            order.FulFilledByOther.push(p.xp.FulfilledBy);
                                                        }
                                                    });
                                                }
                                                pd.resolve()
                                            });
                                        return pd.promise;
                                    }));
                            });
                            $q.all(queue).then(function() {
                                d.resolve(data);
                            });
                            return d.promise;
                        });
                }
            }
        })
        .state( 'orders.edit', {
            url: '/:orderid/edit',
            templateUrl:'orders/templates/orderEdit.tpl.html',
            controller:'OrderEditCtrl',
            controllerAs: 'orderEdit',
            resolve: {
                SelectedOrder: function($stateParams, OrderCloud) {
                    return OrderCloud.Orders.Get($stateParams.orderid);
                },
                AvailableSuppliers: function(AdminUserService){
                    return AdminUserService.GetAllSuppliers()
                },
                LineItemList: function($q, Underscore, $stateParams, OrderCloud, AvailableSuppliers) {
                    return OrderCloud.LineItems.List($stateParams.orderid)
                        .then(function(data) {
                            var d = $q.defer();
                            var queue = [];
                            angular.forEach(data.Items, function(li) {
                                queue.push((function() {
                                    var df = $q.defer();
                                    OrderCloud.Products.Get(li.ProductID)
                                        .then(function(product) {
                                            li.Product = product;
                                            if (li.Product.xp.FulfilledBy) {
                                                li.Product.xp.FulFilledByName = Underscore.where(AvailableSuppliers, {'ID':li.Product.xp.FulfilledBy})[0].FirstName;
                                            }
                                            df.resolve();
                                        });
                                    return df.promise;
                                })());
                            });
                            $q.all(queue).then(function() {
                                d.resolve(data);
                            });
                            return d.promise;
                        });
                }
            }
        })
    ;
}

function OrdersController(OrderList) {
    var vm = this;
    vm.list = OrderList;
}

function OrderEditController( $scope, $q, $exceptionHandler, $state, OrderCloud, SelectedOrder, OrdersTypeAheadSearchFactory, LineItemList, $uibModal, AvailableSuppliers, CurrentUser, Underscore) {
    var vm = this,
    orderid = SelectedOrder.ID;
    vm.order = SelectedOrder;
    vm.orderID = SelectedOrder.ID;
    vm.list = LineItemList;
    vm.pagingfunction = PagingFunction;
    $scope.isCollapsedPayment = true;
    $scope.isCollapsedBilling = true;
    $scope.isCollapsedShipping = true;

    vm.changeFulfillment = function(scope) {
        $uibModal.open({
            animation: true,
            templateUrl: 'orders/templates/orderEdit.changeFulfillment.tpl.html',
            controller: 'ChangeFulfillmentCtrl',
            controllerAs: 'changeFull',
            size: 'lg',
            resolve: {
                SelectedLineItem:function() {
                    return scope.li;
                },
                AvailableSupplierList:function() {
                    return AvailableSuppliers;
                }
            }
        }).result
            .then(function(supplier) {
                if (scope.li.xp) {
                    scope.li.xp.FulfillOverride = {
                        ID: supplier.ID,
                        Name: supplier.FirstName
                    }
                } else {
                    scope.li.xp = {
                        FulfillOverride: {
                            ID: supplier.ID,
                            Name: supplier.FirstName
                        }
                    };
                }
                OrderCloud.LineItems.Update(orderid, scope.li.ID, scope.li)
                    .then(function() {
                        $state.reload();
                    })
            })
            .catch(function(clearOverride) {
                if (clearOverride) {
                    delete scope.li.xp.FulfillOverride;
                    OrderCloud.LineItems.Update(orderid, scope.li.ID, scope.li)
                        .then(function() {
                            $state.reload();
                        })
                }
            })
    };

    vm.fulfillLineItem = function(scope) {
        $uibModal.open({
            animation: true,
            templateUrl: 'orders/templates/orderEdit.fulfillment.modal.tpl.html',
            controller: 'FulfillLineItemCtrl',
            controllerAs: 'fulfillItem',
            size: 'lg',
            resolve: {
                SelectedLineItem:function() {
                    return scope.li;
                },
                OrderID:function() {
                    return vm.orderID;
                },
                CurrentUser: function() {
                    return CurrentUser;
                }
            }
        }).result
            .then(function(shipmentObj) {
                OrderCloud.Shipments.Create(shipmentObj).then(function() {
                    if (scope.li.xp) {
                        scope.li.xp.Fulfilled = true;
                    } else {
                        scope.li.xp = {
                            Fulfilled: true
                        }
                    }
                    OrderCloud.LineItems.Update(vm.orderID, scope.li.ID, scope.li)
                        .then(function() {
                            $state.reload();
                        });
                });
            })
    };

    vm.viewProof = function(imgUrl) {
        $uibModal.open({
            animation: true,
            templateUrl: 'orders/templates/proof.modal.tpl.html',
            controller: 'ProofModalCtrl',
            controllerAs: 'proofModal',
            size: 'md',
            resolve: {
                imageUrl: function() {
                    return imgUrl;
                }
            }
        })
    };

    vm.deleteLineItem = function(lineitem) {
        OrderCloud.LineItems.Delete(orderid, lineitem.ID)
            .then(function() {
                $state.go($state.current, {}, {reload: true});
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    vm.updateBillingAddress = function(){
        vm.order.BillingAddressID = null;
        vm.order.BillingAddress.ID = null;
        OrderCloud.Orders.Update(orderid, vm.order)
            .then(function(){
                OrderCloud.Orders.SetBillingAddress(orderid, vm.order.BillingAddress)
                .then(function() {
                    $state.go($state.current, {}, {reload: true});
                });
        })
    };

    vm.updateShippingAddress = function(){
        OrderCloud.Orders.SetShippingAddress(orderid, vm.ShippingAddress);
            //.then(function() {
            //    $state.go($state.current, {}, {reload: true});
            //});
    };

    vm.Submit = function() {
        var dfd = $q.defer();
        var queue = [];
        angular.forEach(vm.list.Items, function(lineitem, index) {
            if ($scope.EditForm.LineItems['Quantity' + index].$dirty || $scope.EditForm.LineItems['UnitPrice' + index].$dirty ) {
                queue.push(OrderCloud.LineItems.Update(orderid, lineitem.ID, lineitem));
            }
        });
        $q.all(queue)
            .then(function() {
                dfd.resolve();
                OrderCloud.Orders.Update(orderid, vm.order)
                    .then(function() {
                        $state.go('orders', {}, {reload:true});
                    })
                    .catch(function(ex) {
                        $exceptionHandler(ex)
                    });
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });

        return dfd.promise;
    };

    vm.Delete = function() {
        OrderCloud.Orders.Delete(orderid)
            .then(function() {
                $state.go('orders', {}, {reload:true});
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    function PagingFunction() {
        if (vm.list.Meta.Page < vm.list.Meta.PageSize) {
            OrderCloud.LineItems.List(vm.order.ID, vm.list.Meta.Page + 1, vm.list.Meta.PageSize).then(
                function(data) {
                    vm.list.Meta = data.Meta;
                    vm.list.Items = [].concat(vm.list.Items, data.Items);
                }
            )
        }
    }
    vm.spendingAccountTypeAhead = OrdersTypeAheadSearchFactory.SpendingAccountList;
    vm.shippingAddressTypeAhead = OrdersTypeAheadSearchFactory.ShippingAddressList;
    vm.billingAddressTypeAhead = OrdersTypeAheadSearchFactory.BillingAddressList;
}

function OrdersTypeAheadSearchFactory($q, OrderCloud, Underscore) {
    return {
        SpendingAccountList: SpendingAccountList,
        ShippingAddressList: ShippingAddressList,
        BillingAddressList: BillingAddressList
    };

    function SpendingAccountList(term) {
        return OrderCloud.SpendingAccounts.List(term).then(function(data) {
            return data.Items;
        });
    }

    function ShippingAddressList(term) {
        var dfd = $q.defer();
        var queue = [];
        queue.push(OrderCloud.Addresses.List(term));
        queue.push(OrderCloud.Addresses.ListAssignments(null, null, null, null, true));
        $q.all(queue)
            .then(function(result) {
                var searchAssigned = Underscore.intersection(Underscore.pluck(result[0].Items, 'ID'), Underscore.pluck(result[1].Items, 'AddressID'));
                var addressList = Underscore.filter(result[0].Items, function(address) {
                    if (searchAssigned.indexOf(address.ID) > -1) {
                        return address;
                    }
                });
                dfd.resolve(addressList);
            });
        return dfd.promise;
    }

    function BillingAddressList(term) {
        var dfd = $q.defer();
        var queue = [];
        queue.push(OrderCloud.Addresses.List(term));
        queue.push(OrderCloud.Addresses.ListAssignments(null, null, null, null, null, true));
        $q.all(queue)
            .then(function(result) {
                var searchAssigned = Underscore.intersection(Underscore.pluck(result[0].Items, 'ID'), Underscore.pluck(result[1].Items, 'AddressID'));
                var addressList = Underscore.filter(result[0].Items, function(address) {
                    if (searchAssigned.indexOf(address.ID) > -1) {
                        return address;
                    }
                });
                dfd.resolve(addressList);
            });
        return dfd.promise;
    }
}

function ChangeFulfillmentCtrl(SelectedLineItem, AvailableSupplierList, $uibModalInstance, Underscore) {
    var vm = this;
    vm.selectedSupplier = setSelectedSupplier();
    function setSelectedSupplier() {
        if (SelectedLineItem.xp && SelectedLineItem.xp.FulfillOverride) {
            return Underscore.where(AvailableSupplierList, {'ID':SelectedLineItem.xp.FulfillOverride.ID})[0];
        } else {
            return Underscore.where(AvailableSupplierList, {'ID':SelectedLineItem.Product.xp.FulfilledBy})[0];
        }
    }
    vm.suppliers = AvailableSupplierList;
    vm.lineItem = SelectedLineItem;

    vm.confirm = function() {
        $uibModalInstance.close(vm.selectedSupplier);
    };

    vm.clearOverride = function() {
        $uibModalInstance.dismiss(true);
    };

    vm.cancel = function() {
        $uibModalInstance.dismiss(false);
    }
}

function FulfillLineItemCtrl($uibModalInstance, SelectedLineItem, OrderID, CurrentUser) {
    var vm = this;
    vm.lineItem = SelectedLineItem;
    vm.shipment = {
        "Shipper": CurrentUser.xp.UserType == 'Supplier' ? 'Vendor' : 'FedEx',
        "DateShipped": new Date(),
        "TrackingNumber": null,
        "Cost": null,
        "Items": [
            {
                "OrderID": OrderID,
                "LineItemId": SelectedLineItem.ID,
                "QuantityShipped": SelectedLineItem.Quantity
            }
        ]
    };

    vm.confirm = function() {
        $uibModalInstance.close(vm.shipment);
    }

    vm.cancel = function() {
        $uibModalInstance.dismiss();
    }
}

function ProofModalCtrl(imageUrl) {
    var vm = this;
    vm.imageUrl = imageUrl;
}