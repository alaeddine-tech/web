#include<stdio.h>
#include<stdlib>
typedef tsruct node {
 struct node *next;
 int data;
}node;
node creat(){
    node newNode=malloc(sizeof(node));
    newNode.next=null;

}
node insetTFirst(){
    newNode.creat();
    newNode->next=newNode;
    
}

