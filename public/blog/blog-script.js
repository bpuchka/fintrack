document.addEventListener('DOMContentLoaded', function() {
    // Modal elements (only exist for admin users)
    const createModal = document.getElementById('createPostModal');
    const editModal = document.getElementById('editPostModal');
    const newPostBtn = document.getElementById('newPostBtn');
    const closeBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    
    // Initialize TinyMCE if admin is logged in
    if (document.getElementById('createContent')) {
        initializeTinyMCE();
    }
    
    // Search functionality
    const searchInput = document.getElementById('blogSearch');
    const searchButton = document.getElementById('searchButton');
    
    if (searchInput && searchButton) {
        // Search when button is clicked
        searchButton.addEventListener('click', function() {
            performSearch();
        });
        
        // Search when Enter key is pressed
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        function performSearch() {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/blog?search=${encodeURIComponent(query)}`;
            } else {
                window.location.href = '/blog';
            }
        }
    }
    
    // Modal functionality (only for admin users)
    if (newPostBtn) {
        // Open Create Post Modal
        newPostBtn.addEventListener('click', function() {
            openModal(createModal);
        });
        
        // Close Modals
        closeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                closeModal(modal);
            });
        });
        
        // Close modal if clicked outside
        window.addEventListener('click', function(event) {
            if (event.target === createModal) {
                closeModal(createModal);
            } else if (event.target === editModal) {
                closeModal(editModal);
            }
        });
        
        // Handle create post form submission
        const createForm = document.getElementById('createPostForm');
        if (createForm) {
            createForm.addEventListener('submit', function(e) {
                e.preventDefault();
                createPost();
            });
        }
        
        // Handle edit post form submission
        const editForm = document.getElementById('editPostForm');
        if (editForm) {
            editForm.addEventListener('submit', function(e) {
                e.preventDefault();
                updatePost();
            });
        }
        
        // Open Edit Post Modal
        const editButtons = document.querySelectorAll('.admin-control-btn.edit');
        if (editButtons) {
            editButtons.forEach(button => {
                button.addEventListener('click', async function() {
                    const postId = this.getAttribute('data-post-id');
                    await loadPostData(postId);
                    openModal(editModal);
                });
            });
        }
    }
    
    // Delete post functionality (only for admin users)
    const deleteButtons = document.querySelectorAll('.admin-control-btn.delete');
    if (deleteButtons) {
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const postId = this.getAttribute('data-post-id');
                
                if (confirm('Сигурни ли сте, че искате да изтриете тази статия?')) {
                    deletePost(postId, this);
                }
            });
        });
    }
    
    // Functions
    function initializeTinyMCE() {
        tinymce.init({
            selector: '#createContent',
            height: 400,
            menubar: true,
            plugins: [
                'advlist autolink lists link image charmap print preview anchor',
                'searchreplace visualblocks code fullscreen',
                'insertdatetime media table paste code help wordcount'
            ],
            toolbar: 'undo redo | formatselect | bold italic backcolor | ' +
                'alignleft aligncenter alignright alignjustify | ' +
                'bullist numlist outdent indent | removeformat | help',
            content_style: 'body { font-family:Poppins,Arial,sans-serif; font-size:16px; color:#f0f0f0; background-color:#333; }'
        });
        
        tinymce.init({
            selector: '#editContent',
            height: 400,
            menubar: true,
            plugins: [
                'advlist autolink lists link image charmap print preview anchor',
                'searchreplace visualblocks code fullscreen',
                'insertdatetime media table paste code help wordcount'
            ],
            toolbar: 'undo redo | formatselect | bold italic backcolor | ' +
                'alignleft aligncenter alignright alignjustify | ' +
                'bullist numlist outdent indent | removeformat | help',
            content_style: 'body { font-family:Poppins,Arial,sans-serif; font-size:16px; color:#f0f0f0; background-color:#333; }'
        });
    }
    
    function openModal(modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
    
    function closeModal(modal) {
        modal.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    async function loadPostData(postId) {
        try {
            const response = await fetch(`/api/blog/${postId}`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('editPostId').value = data.post.id;
                document.getElementById('editTitle').value = data.post.title;
                
                // Set content to TinyMCE
                tinymce.get('editContent').setContent(data.post.content);
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to load post data.');
        }
    }
    
    function createPost() {
        const title = document.getElementById('createTitle').value.trim();
        const content = tinymce.get('createContent').getContent();
        
        if (!title) {
            alert('Моля, въведете заглавие на статията.');
            return;
        }
        
        if (!content) {
            alert('Моля, въведете съдържание на статията.');
            return;
        }
        
        fetch('/api/blog', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: content
            }),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Статията беше създадена успешно!');
                window.location.reload();
            } else {
                alert('Грешка: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Възникна грешка при създаването на статията.');
        });
    }
    
    function updatePost() {
        const postId = document.getElementById('editPostId').value;
        const title = document.getElementById('editTitle').value.trim();
        const content = tinymce.get('editContent').getContent();
        
        if (!title) {
            alert('Моля, въведете заглавие на статията.');
            return;
        }
        
        if (!content) {
            alert('Моля, въведете съдържание на статията.');
            return;
        }
        
        fetch(`/api/blog/${postId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: content
            }),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Статията беше обновена успешно!');
                window.location.reload();
            } else {
                alert('Грешка: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Възникна грешка при обновяването на статията.');
        });
    }
    
    function deletePost(postId, buttonElement) {
        fetch(`/api/blog/${postId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove the blog card from the grid
                const card = buttonElement.closest('.blog-card');
                card.remove();
                
                // Check if grid is empty and add "no posts" message if needed
                const grid = document.querySelector('.blog-grid');
                if (grid.childElementCount === 0) {
                    const noPostsDiv = document.createElement('div');
                    noPostsDiv.className = 'no-posts';
                    noPostsDiv.innerHTML = '<p>Няма публикувани статии в момента.</p>';
                    grid.appendChild(noPostsDiv);
                }
                
                alert('Статията беше успешно изтрита!');
            } else {
                alert('Грешка: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Възникна грешка при изтриването на статията.');
        });
    }
});